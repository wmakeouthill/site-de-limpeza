import io
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.domain.entities  # noqa: F401
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.database.session import get_db_session
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.main import create_app

TEST_USER = CmsUser(
    email="admin@falcaolimpeza.com.br",
    name="Admin Falcão",
    object_id="user-falcao-admin",
)


@pytest.fixture
def test_settings(tmp_path) -> Settings:
    return Settings(
        ENVIRONMENT="test",
        CMS_SESSION_SECRET="test-secret-falcao-media-session-32bytes",
        CMS_UPLOAD_DIR=str(tmp_path / "uploads"),
        PUBLIC_TESTIMONIALS_ENABLED=False,
    )


@pytest_asyncio.fixture
async def test_session_maker():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    yield session_maker
    await engine.dispose()


@pytest.fixture
def client(test_settings: Settings, test_session_maker) -> TestClient:
    app = create_app()

    async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with test_session_maker() as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_db_session] = override_get_db_session
    app.dependency_overrides[require_cms_user] = lambda: TEST_USER
    return TestClient(app)


def _generate_image_bytes(format_name: str) -> bytes:
    img = Image.new("RGB", (20, 20), color="navy")
    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()


def test_media_upload_and_serve_supported_formats(client: TestClient) -> None:
    formats = [
        ("PNG", "test-image.png", "image/png"),
        ("JPEG", "test-image.jpg", "image/jpeg"),
        ("WEBP", "test-image.webp", "image/webp"),
        ("GIF", "test-image.gif", "image/gif"),
    ]

    for fmt, filename, mime in formats:
        img_bytes = _generate_image_bytes(fmt)
        res = client.post(
            "/api/cms/uploads",
            files={"file": (filename, img_bytes, mime)},
        )
        assert res.status_code == 201, f"Failed for {fmt}: {res.text}"
        data = res.json()
        assert "url" in data
        assert data["sizeBytes"] > 0
        media_url = data["url"]

        # Fetch served media and verify nosniff header
        media_res = client.get(media_url)
        assert media_res.status_code == 200
        assert media_res.headers.get("x-content-type-options") == "nosniff"
        assert "max-age" in media_res.headers.get("cache-control", "")


def test_media_upload_rejects_svg_with_415(client: TestClient) -> None:
    # 1. By extension .svg
    res_ext = client.post(
        "/api/cms/uploads",
        files={"file": ("malicious.svg", b"<svg></svg>", "image/svg+xml")},
    )
    assert res_ext.status_code == 415

    # 2. By MIME type image/svg+xml
    res_mime = client.post(
        "/api/cms/uploads",
        files={"file": ("malicious.png", b"<svg></svg>", "image/svg+xml")},
    )
    assert res_mime.status_code == 415

    # 3. Disguised SVG in PNG extension with image/png MIME
    svg_payload = b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    res_disguised = client.post(
        "/api/cms/uploads",
        files={"file": ("disguised.png", svg_payload, "image/png")},
    )
    assert res_disguised.status_code == 415


def test_media_upload_rejects_corrupted_image_with_415(client: TestClient) -> None:
    corrupted_bytes = b"NOT_AN_IMAGE_RANDOM_CORRUPTED_BYTES_DATA"
    res = client.post(
        "/api/cms/uploads",
        files={"file": ("corrupted.png", corrupted_bytes, "image/png")},
    )
    assert res.status_code == 415


def test_media_upload_rejects_files_over_5mb_with_413(client: TestClient) -> None:
    # 5 MiB + 1 byte
    oversized_bytes = b"A" * (5 * 1024 * 1024 + 1)
    res = client.post(
        "/api/cms/uploads",
        files={"file": ("huge.png", oversized_bytes, "image/png")},
    )
    assert res.status_code == 413


def test_media_path_traversal_is_blocked(client: TestClient) -> None:
    img_bytes = _generate_image_bytes("PNG")
    # Upload with directory traversal in filename
    res = client.post(
        "/api/cms/uploads",
        files={"file": ("../../escape.png", img_bytes, "image/png")},
    )
    assert res.status_code == 201
    url = res.json()["url"]
    assert ".." not in url

    # Direct traversal query on media endpoint
    res_traversal = client.get("/media/../etc/passwd")
    assert res_traversal.status_code == 404


def test_cms_testimonials_crud_and_reorder(client: TestClient) -> None:
    # 1. Create Testimonial
    payload1 = {
        "site": "falcao",
        "author": "Carlos Drummond",
        "role": "Empresário",
        "company": "Construtora Silva",
        "quote": "Assessoria jurídica penal impecável e ágil.",
        "avatar_url": "https://falcaolimpeza.com.br/assets/carlos.webp",
        "is_active": True,
    }
    create_res1 = client.post("/api/cms/testimonials", json=payload1)
    assert create_res1.status_code == 201, create_res1.text
    id1 = create_res1.json()["id"]
    assert create_res1.json()["sort_order"] == 0

    payload2 = {
        "site": "falcao",
        "author": "Mariana Souza",
        "role": "Diretora Financeira",
        "company": "Grupo Beta",
        "quote": "Excelente atuação em compliance penal.",
        "is_active": True,
    }
    create_res2 = client.post("/api/cms/testimonials", json=payload2)
    assert create_res2.status_code == 201
    id2 = create_res2.json()["id"]
    assert create_res2.json()["sort_order"] == 1

    # 2. List Testimonials in CMS
    list_res = client.get("/api/cms/testimonials")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 2
    assert [item["id"] for item in items] == [id1, id2]

    # 3. Update Testimonial
    update_res = client.put(
        f"/api/cms/testimonials/{id1}",
        json={**payload1, "role": "Diretor Presidente"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["role"] == "Diretor Presidente"

    # 4. Reorder Testimonials
    reorder_res = client.put(
        "/api/cms/testimonials/reorder",
        json={"site": "falcao", "ids": [id2, id1]},
    )
    assert reorder_res.status_code == 204

    # Verify reorder persisted
    list_after_reorder = client.get("/api/cms/testimonials").json()
    assert [item["id"] for item in list_after_reorder] == [id2, id1]

    # Reorder with non-existent ID fails with 422
    invalid_reorder = client.put(
        "/api/cms/testimonials/reorder",
        json={"site": "falcao", "ids": ["non-existent-id-123"]},
    )
    assert invalid_reorder.status_code == 422

    # 5. Delete Testimonial
    del_res = client.delete(f"/api/cms/testimonials/{id1}")
    assert del_res.status_code == 204
    assert len(client.get("/api/cms/testimonials").json()) == 1


def test_public_testimonials_lists_only_active_testimonials(client: TestClient) -> None:
    # 1. Create active and inactive testimonials via CMS (CA-21)
    client.post("/api/cms/testimonials", json={
        "site": "falcao",
        "author": "Roberto Ramos",
        "quote": "Atendimento rápido na loja.",
        "is_active": True,
    })
    client.post("/api/cms/testimonials", json={
        "site": "falcao",
        "author": "Inativo Teste",
        "quote": "Não deve aparecer no site.",
        "is_active": False,
    })

    # 2. Public endpoint returns only active testimonials
    pub_res = client.get("/api/public/testimonials")
    assert pub_res.status_code == 200
    items = pub_res.json()
    assert any(i["author"] == "Roberto Ramos" for i in items)
    assert not any(i["author"] == "Inativo Teste" for i in items)
