from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
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
    email="advogado.parceiro@falcaolimpeza.com.br",
    name="Lucas Falcão",
    object_id="user-123",
)


@pytest.fixture
def test_settings(tmp_path) -> Settings:
    return Settings(
        ENVIRONMENT="test",
        CMS_SESSION_SECRET="test-secret-falcao-editorial-session-32bytes",
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


def test_guide_requires_a_topic_instead_of_a_client(client: TestClient) -> None:
    # 1. Valid Falcão Guide with topic
    valid_payload = {
        "slug": "guia-defesa-flagrante",
        "title": "Guia Prático de Defesa em Prisão em Flagrante",
        "excerpt": "Orientações fundamentais para as primeiras 24 horas.",
        "body_markdown": "## O que fazer na delegacia\n\nDireitos do preso.",
        "case_detail": {
            "topic": "Direito Penal e Processo Penal",
            "screenshot_url": "https://falcaolimpeza.com.br/assets/guia-cover.webp",
            "screenshot_position_x": 50,
            "screenshot_position_y": 50,
            "screenshot_zoom": 100,
        },
        "tags": [{"label": "Flagrante", "sort_order": 0}, {"label": "Delegacia", "sort_order": 1}],
    }
    response = client.post("/api/cms/cases", json=valid_payload)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["topic"] == "Direito Penal e Processo Penal"
    assert "client_name" not in data
    assert "metrics" not in data
    assert len(data["tags"]) == 2

    # 2. Rejecting client_name in case_detail with 422
    payload_with_client = {
        **valid_payload,
        "slug": "guia-invalid-client",
        "case_detail": {
            "topic": "Direito Penal",
            "client_name": "Empresa Cliente X",
        },
    }
    response_client = client.post("/api/cms/cases", json=payload_with_client)
    assert response_client.status_code == 422

    # 3. Rejecting metrics in payload with 422
    payload_with_metrics = {
        **valid_payload,
        "slug": "guia-invalid-metrics",
        "metrics": [{"value": "100%", "label": "Taxa de Sucesso"}],
    }
    response_metrics = client.post("/api/cms/cases", json=payload_with_metrics)
    assert response_metrics.status_code == 422

    # 4. Rejecting missing topic with 422
    payload_missing_topic = {
        **valid_payload,
        "slug": "guia-missing-topic",
        "case_detail": {
            "screenshot_url": "https://falcaolimpeza.com.br/assets/cover.png",
        },
    }
    response_missing = client.post("/api/cms/cases", json=payload_missing_topic)
    assert response_missing.status_code == 422

    # 5. Rejecting empty topic with 422
    payload_empty_topic = {
        **valid_payload,
        "slug": "guia-empty-topic",
        "case_detail": {
            "topic": "",
        },
    }
    response_empty = client.post("/api/cms/cases", json=payload_empty_topic)
    assert response_empty.status_code == 422


def test_guide_editorial_lifecycle_and_slug_collision(client: TestClient) -> None:
    payload = {
        "slug": "guia-audiencia-custodia",
        "title": "Como Funciona a Audiência de Custódia",
        "excerpt": "Procedimentos e direitos fundamentais.",
        "body_markdown": "Conteúdo instrutivo detalhado.",
        "case_detail": {
            "topic": "Processo Penal",
            "screenshot_url": "https://falcaolimpeza.com.br/assets/custodia.webp",
        },
        "tags": [{"label": "Custódia", "sort_order": 0}],
    }
    # 1. Create Draft
    create_res = client.post("/api/cms/cases", json=payload)
    assert create_res.status_code == 201
    guide_id = create_res.json()["id"]
    assert create_res.json()["status"] == "draft"

    # 2. Publish
    pub_res = client.post(f"/api/cms/cases/{guide_id}/publish")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "published"
    assert pub_data["published_at"] is not None
    assert pub_data["published_author_name"] == "Lucas Falcão"

    # 3. Public visibility
    pub_list_res = client.get("/api/public/cases")
    assert pub_list_res.status_code == 200
    public_cases = pub_list_res.json()
    assert any(c["slug"] == "guia-audiencia-custodia" for c in public_cases)
    card = next(c for c in public_cases if c["slug"] == "guia-audiencia-custodia")
    assert card["topic"] == "Processo Penal"
    assert "client" not in card
    assert "metrics" not in card

    # Public detail
    detail_res = client.get("/api/public/cases/guia-audiencia-custodia")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["topic"] == "Processo Penal"
    assert detail_data["author"] == "Lucas Falcão"
    assert "published_by" not in detail_data
    assert "author_email" not in detail_data

    # 4. Slug collision on duplicate create
    dup_res = client.post("/api/cms/cases", json=payload)
    assert dup_res.status_code == 409

    # 5. Unpublish
    unpub_res = client.post(f"/api/cms/cases/{guide_id}/unpublish")
    assert unpub_res.status_code == 200
    assert unpub_res.json()["status"] == "draft"

    # Now public detail should 404
    detail_404 = client.get("/api/public/cases/guia-audiencia-custodia")
    assert detail_404.status_code == 404

    # 6. Archive and Unarchive
    arch_res = client.post(f"/api/cms/cases/{guide_id}/archive")
    assert arch_res.status_code == 200
    assert arch_res.json()["status"] == "archived"

    unarch_res = client.post(f"/api/cms/cases/{guide_id}/unarchive")
    assert unarch_res.status_code == 200
    assert unarch_res.json()["status"] == "draft"

    # 7. Delete
    del_res = client.delete(f"/api/cms/cases/{guide_id}")
    assert del_res.status_code == 204


def test_body_markdown_size_limits(client: TestClient) -> None:
    # 256 KiB = 262144 characters
    exact_limit_body = "A" * 262144
    payload_exact = {
        "slug": "guia-limite-exato",
        "title": "Guia com Tamanho Exato no Limite",
        "excerpt": "Resumo",
        "body_markdown": exact_limit_body,
        "case_detail": {
            "topic": "Direito Civil",
        },
    }
    res_exact = client.post("/api/cms/cases", json=payload_exact)
    assert res_exact.status_code == 201

    # 256 KiB + 1 = 262145 characters
    exceeded_body = "A" * 262145
    payload_exceeded = {
        "slug": "guia-limite-excedido",
        "title": "Guia com Tamanho Acima do Limite",
        "excerpt": "Resumo",
        "body_markdown": exceeded_body,
        "case_detail": {
            "topic": "Direito Civil",
        },
    }
    res_exceeded = client.post("/api/cms/cases", json=payload_exceeded)
    assert res_exceeded.status_code == 422


def test_site_settings_public_toggles_and_blocking(client: TestClient) -> None:
    # 1. Publish one article and one guide
    art_payload = {
        "slug": "artigo-revisao-criminal",
        "title": "Revisão Criminal Passo a Passo",
        "excerpt": "Entenda quando cabe a revisão criminal.",
        "body_markdown": "Conteúdo do artigo.",
        "article_detail": {
            "area": "Penal",
            "reading_time": "5 min",
        },
    }
    art_res = client.post("/api/cms/articles", json=art_payload)
    assert art_res.status_code == 201
    art_id = art_res.json()["id"]
    client.post(f"/api/cms/articles/{art_id}/publish")

    guide_payload = {
        "slug": "guia-revisao-criminal",
        "title": "Guia Prático de Revisão Criminal",
        "excerpt": "Guia completo de atuação.",
        "body_markdown": "Conteúdo do guia.",
        "case_detail": {
            "topic": "Penal",
        },
    }
    guide_res = client.post("/api/cms/cases", json=guide_payload)
    assert guide_res.status_code == 201
    guide_id = guide_res.json()["id"]
    client.post(f"/api/cms/cases/{guide_id}/publish")

    # 2. Check public settings exposes only flags
    settings_res = client.get("/api/public/site-settings")
    assert settings_res.status_code == 200
    pub_settings = settings_res.json()
    assert {"articles_enabled", "guides_enabled", "testimonials_enabled"}.issubset(pub_settings.keys())
    assert pub_settings["articles_enabled"] is True
    assert pub_settings["guides_enabled"] is True
    assert pub_settings["testimonials_enabled"] is False

    # 3. Disable guides via CMS settings
    update_res = client.put(
        "/api/cms/site-settings",
        json={
            "articles_enabled": {"falcao": True},
            "guides_enabled": False,
            "contact_notification_recipients": ["equipe@falcaolimpeza.com.br"],
        },
    )
    assert update_res.status_code == 200
    assert update_res.json()["guides_enabled"] is False

    # Public cases endpoint now returns empty list
    cases_blocked = client.get("/api/public/cases")
    assert cases_blocked.status_code == 200
    assert cases_blocked.json() == []

    # Public case detail returns 404
    case_detail_blocked = client.get("/api/public/cases/guia-revisao-criminal")
    assert case_detail_blocked.status_code == 404

    # Articles remain accessible
    articles_ok = client.get("/api/public/articles")
    assert articles_ok.status_code == 200
    assert len(articles_ok.json()) >= 1

    # 4. Disable articles via CMS settings
    client.put(
        "/api/cms/site-settings",
        json={
            "articles_enabled": {"falcao": False},
            "guides_enabled": True,
            "contact_notification_recipients": ["equipe@falcaolimpeza.com.br"],
        },
    )
    articles_blocked = client.get("/api/public/articles")
    assert articles_blocked.status_code == 200
    assert articles_blocked.json() == []

    article_detail_blocked = client.get("/api/public/articles/artigo-revisao-criminal")
    assert article_detail_blocked.status_code == 404


def test_article_likes_toggle_and_anonymous_cookie(client: TestClient) -> None:
    # Create and publish article
    art_payload = {
        "slug": "artigo-habeas-corpus",
        "title": "Habeas Corpus no STJ e STF",
        "excerpt": "Principais teses defensivas.",
        "body_markdown": "Texto sobre HC.",
        "article_detail": {
            "area": "Penal",
            "reading_time": "7 min",
        },
    }
    art_res = client.post("/api/cms/articles", json=art_payload)
    client.post(f"/api/cms/articles/{art_res.json()['id']}/publish")

    # Initial state sets the anonymous visitor cookie
    state_res = client.get("/api/public/articles/artigo-habeas-corpus/likes")
    assert state_res.status_code == 200
    assert state_res.json()["liked"] is False
    assert state_res.json()["likes_count"] == 0
    assert "talimpo_article_visitor" in state_res.cookies or "talimpo_article_visitor" in client.cookies

    # Toggle like -> liked=True, count=1
    toggle_res1 = client.post("/api/public/articles/artigo-habeas-corpus/likes/toggle")
    assert toggle_res1.status_code == 200
    assert toggle_res1.json()["liked"] is True
    assert toggle_res1.json()["likes_count"] == 1

    # Toggle like again -> liked=False, count=0
    toggle_res2 = client.post("/api/public/articles/artigo-habeas-corpus/likes/toggle")
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["liked"] is False
    assert toggle_res2.json()["likes_count"] == 0


def test_author_email_is_never_exposed_in_public_endpoints(client: TestClient) -> None:
    # 1. Publish article with author email in user session
    art_payload = {
        "slug": "artigo-privacidade-autor",
        "title": "Artigo Sobre Privacidade",
        "excerpt": "Resumo do artigo.",
        "body_markdown": "Corpo do texto.",
        "article_detail": {
            "area": "Compliance",
            "reading_time": "3 min",
        },
    }
    art_res = client.post("/api/cms/articles", json=art_payload)
    client.post(f"/api/cms/articles/{art_res.json()['id']}/publish")

    detail_res = client.get("/api/public/articles/artigo-privacidade-autor")
    assert detail_res.status_code == 200
    detail_text = detail_res.text
    # Must NOT contain the email address of the author
    assert "advogado.parceiro@falcaolimpeza.com.br" not in detail_text
    data = detail_res.json()
    assert "@" not in data["author"]
    assert "published_by" not in data
    assert "author_email" not in data
