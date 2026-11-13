from collections.abc import AsyncGenerator
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.cli
import app.domain.entities  # noqa: F401
from app.application.services.cms_author_service import CmsAuthorService
from app.domain.entities.cms_session import CmsSession
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.database.session import get_db_session
from app.infrastructure.repositories.cms_author_repository import SqlAlchemyCmsAuthorRepository
from app.infrastructure.repositories.cms_session_repository import (
    SqlAlchemyCmsSessionRepository,
)
from app.infrastructure.security.cms_session import hash_token
from app.infrastructure.security.rate_limiter import SlidingWindowRateLimiter
from app.interfaces.api.v1.cms_cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE
from app.interfaces.api.v1.dependencies.services import get_cms_login_rate_limiter
from app.main import create_app

TEST_SESSION_SECRET = "test-falcao-cms-session-secret-32bytes-minimum"
USER_EMAIL = "socio@falcaolimpeza.com.br"
USER_PASSWORD = "senha-forte-do-socio-123"
OUTSIDER_EMAIL = "intruso@outrodominio.com"
NO_PASSWORD_EMAIL = "admin@falcaolimpeza.com.br"
ALLOWED_ORIGIN = "http://localhost:4321"


@pytest.fixture
def test_settings(tmp_path) -> Settings:
    return Settings(
        APP_NAME="Falcão Limpeza API",
        ENVIRONMENT="test",
        DATABASE_URL="sqlite+aiosqlite:///:memory:",
        CORS_ORIGINS="http://localhost:4321,http://127.0.0.1:4321",
        PUBLIC_SITE_BASE_URL="http://localhost:4321",
        CMS_FRONTEND_URL="http://localhost:4321/cms",
        CMS_UPLOAD_DIR=str(tmp_path / "uploads"),
        CMS_SESSION_SECRET=TEST_SESSION_SECRET,
        CMS_ALLOWED_EMAILS=f"{USER_EMAIL},{NO_PASSWORD_EMAIL}",
        CMS_ACCESS_TOKEN_TTL_MINUTES=15,
        CMS_REFRESH_TOKEN_TTL_DAYS=30,
    )


@pytest.fixture
async def db_session_factory():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        repository = SqlAlchemyCmsAuthorRepository(session)
        service = CmsAuthorService(repository)
        await service.set_password(USER_EMAIL, USER_PASSWORD, "Falcão")
        await service.set_password(OUTSIDER_EMAIL, USER_PASSWORD, "Intruso")
        await repository.upsert(NO_PASSWORD_EMAIL, "Admin sem senha")
    try:
        yield factory
    finally:
        await engine.dispose()


def _build_client(test_settings: Settings, db_session_factory) -> TestClient:
    app = create_app()

    async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with db_session_factory() as session:
            yield session

    # Limiter novo por cliente: o cache global vazaria tentativas entre testes.
    rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=15 * 60)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_db_session] = override_get_db_session
    app.dependency_overrides[get_cms_login_rate_limiter] = lambda: rate_limiter
    return TestClient(app)


def _post_login(client: TestClient, email: str = USER_EMAIL, password: str = USER_PASSWORD):
    return client.post(
        "/api/cms/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": ALLOWED_ORIGIN},
    )


def _login(client: TestClient) -> None:
    res = _post_login(client)
    assert res.status_code == 204, res.text


def test_health_endpoint(test_settings: Settings, db_session_factory) -> None:
    client = _build_client(test_settings, db_session_factory)
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


async def test_password_login_creates_db_session_and_sets_talimpo_cookies(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    res = _post_login(client, email="  Socio@FalcaoLimpeza.com.br ")

    assert res.status_code == 204
    assert "HttpOnly" in res.headers.get("set-cookie", "")
    assert client.cookies.get(ACCESS_COOKIE)
    assert client.cookies.get(REFRESH_COOKIE)
    assert client.cookies.get(CSRF_COOKIE)

    async with db_session_factory() as session:
        repo = SqlAlchemyCmsSessionRepository(session)
        result = await session.execute(CmsSession.__table__.select())
        rows = result.fetchall()
        assert len(rows) == 1
        db_sess = await repo.find_by_id(rows[0].id)
        assert db_sess is not None
        assert db_sess.user_email == USER_EMAIL
        assert db_sess.refresh_token_hash == hash_token(client.cookies.get(REFRESH_COOKIE))
        assert db_sess.csrf_token_hash == hash_token(client.cookies.get(CSRF_COOKIE))
        assert db_sess.revoked_at is None


@pytest.mark.parametrize(
    ("email", "password"),
    [
        (USER_EMAIL, "senha-errada-qualquer"),
        ("ninguem@falcaolimpeza.com.br", USER_PASSWORD),
        (NO_PASSWORD_EMAIL, "qualquer-coisa"),
    ],
    ids=["senha-errada", "email-desconhecido", "autor-sem-senha"],
)
def test_login_failures_return_same_generic_401_without_cookies(
    test_settings: Settings,
    db_session_factory,
    email: str,
    password: str,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    res = _post_login(client, email=email, password=password)

    assert res.status_code == 401
    assert res.json() == {"detail": "E-mail ou senha invalidos."}
    assert not client.cookies.get(ACCESS_COOKIE)


def test_login_rejects_empty_password_at_schema(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    assert _post_login(client, email=NO_PASSWORD_EMAIL, password="").status_code == 422


def test_login_with_correct_password_but_not_allowlisted_returns_403(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    res = _post_login(client, email=OUTSIDER_EMAIL)

    assert res.status_code == 403
    assert not client.cookies.get(ACCESS_COOKIE)


def test_login_rejects_unauthorized_origin(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    res = client.post(
        "/api/cms/auth/login",
        json={"email": USER_EMAIL, "password": USER_PASSWORD},
        headers={"Origin": "https://evil.example.com"},
    )

    assert res.status_code == 403
    assert not client.cookies.get(ACCESS_COOKIE)


def test_login_is_rate_limited_even_with_correct_password(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    for _ in range(10):
        assert _post_login(client, password="senha-errada-qualquer").status_code == 401

    res = _post_login(client)

    assert res.status_code == 429
    assert not client.cookies.get(ACCESS_COOKIE)


def test_login_returns_503_when_session_secret_missing(
    test_settings: Settings,
    db_session_factory,
) -> None:
    unconfigured = test_settings.model_copy(update={"cms_session_secret": ""})
    client = _build_client(unconfigured, db_session_factory)

    assert _post_login(client).status_code == 503


def test_set_password_cli_revokes_sessions_and_swaps_password(
    test_settings: Settings,
    db_session_factory,
    monkeypatch,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    _login(client)
    assert client.get("/api/cms/auth/me").status_code == 200
    new_password = "nova-senha-trocada-456"

    async def fake_dispose() -> None:
        return None

    monkeypatch.setattr(app.cli, "AsyncSessionLocal", db_session_factory)
    monkeypatch.setattr(app.cli, "engine", SimpleNamespace(dispose=fake_dispose))
    monkeypatch.setattr(app.cli, "get_settings", lambda: test_settings)
    monkeypatch.setattr(app.cli.getpass, "getpass", lambda _prompt: new_password)

    assert app.cli.main(["set-password", USER_EMAIL]) == 0

    assert client.get("/api/cms/auth/me").status_code == 401
    assert client.post("/api/cms/auth/refresh").status_code == 401
    assert _post_login(client).status_code == 401
    assert _post_login(client, password=new_password).status_code == 204


def test_set_password_cli_rejects_short_password(
    test_settings: Settings,
    db_session_factory,
    monkeypatch,
) -> None:
    monkeypatch.setattr(app.cli, "AsyncSessionLocal", db_session_factory)
    monkeypatch.setattr(app.cli, "get_settings", lambda: test_settings)
    monkeypatch.setattr(app.cli.getpass, "getpass", lambda _prompt: "curta")

    with pytest.raises(SystemExit, match="12 caracteres"):
        app.cli.main(["set-password", USER_EMAIL])


def test_me_endpoint_returns_profile_and_csrf_or_401_when_unauthenticated(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)

    unauth_res = client.get("/api/cms/auth/me")
    assert unauth_res.status_code == 401

    _login(client)
    me_res = client.get("/api/cms/auth/me")
    assert me_res.status_code == 200
    body = me_res.json()
    assert body["email"] == USER_EMAIL
    assert body["name"] == "Falcão"
    assert body["csrfToken"] == client.cookies.get(CSRF_COOKIE)


def test_cms_mutation_requires_valid_csrf_and_authorized_origin(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    _login(client)
    csrf_token = client.cookies.get(CSRF_COOKIE)
    assert csrf_token

    payload = {
        "articles_enabled": {"falcao": True},
        "contact_notification_recipients": ["admin@falcaolimpeza.com.br"],
    }

    # Missing X-CSRF-Token -> 403
    no_csrf_res = client.put("/api/cms/settings", json=payload)
    assert no_csrf_res.status_code == 403

    # Divergent X-CSRF-Token -> 403
    bad_csrf_res = client.put(
        "/api/cms/settings",
        json=payload,
        headers={"X-CSRF-Token": "invalid-csrf-token"},
    )
    assert bad_csrf_res.status_code == 403

    # Unauthorized Origin -> 403
    bad_origin_res = client.put(
        "/api/cms/settings",
        json=payload,
        headers={
            "X-CSRF-Token": csrf_token,
            "Origin": "https://evil.example.com",
        },
    )
    assert bad_origin_res.status_code == 403

    # Valid Origin + Valid CSRF -> 200
    ok_res = client.put(
        "/api/cms/settings",
        json=payload,
        headers={
            "X-CSRF-Token": csrf_token,
            "Origin": ALLOWED_ORIGIN,
        },
    )
    assert ok_res.status_code == 200


def test_refresh_rotates_token_and_reuse_of_old_refresh_revokes_session(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    _login(client)

    first_refresh_token = client.cookies.get(REFRESH_COOKIE)
    first_csrf_token = client.cookies.get(CSRF_COOKIE)
    assert first_refresh_token
    assert first_csrf_token

    # 1. Valid refresh rotates refresh_token and csrf_token
    refresh_res = client.post("/api/cms/auth/refresh")
    assert refresh_res.status_code == 204

    second_refresh_token = client.cookies.get(REFRESH_COOKIE)
    second_csrf_token = client.cookies.get(CSRF_COOKIE)
    assert second_refresh_token and second_refresh_token != first_refresh_token
    assert second_csrf_token and second_csrf_token != first_csrf_token

    # Session remains valid with new tokens
    assert client.get("/api/cms/auth/me").status_code == 200

    # 2. Replay/reuse of old refresh token invalidates the entire session and returns 401
    client.cookies.set(REFRESH_COOKIE, first_refresh_token, path="/api/cms/auth")
    replay_res = client.post("/api/cms/auth/refresh")
    assert replay_res.status_code == 401

    # Even if the attacker or client tries the rotated second refresh token afterwards,
    # the session in cms_sessions is now revoked!
    client.cookies.set(REFRESH_COOKIE, second_refresh_token, path="/api/cms/auth")
    after_revoke_res = client.post("/api/cms/auth/refresh")
    assert after_revoke_res.status_code == 401


def test_logout_revokes_session_clears_cookies_and_blocks_subsequent_calls(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    _login(client)

    saved_access = client.cookies.get(ACCESS_COOKIE)
    saved_refresh = client.cookies.get(REFRESH_COOKIE)
    assert saved_access
    assert saved_refresh

    logout_res = client.post("/api/cms/auth/logout")
    assert logout_res.status_code == 204

    # Even if a client replays the previously issued access or refresh cookie after logout,
    # server-side revocation in cms_sessions blocks both with 401
    client.cookies.set(ACCESS_COOKIE, saved_access, path="/")
    assert client.get("/api/cms/auth/me").status_code == 401

    client.cookies.set(REFRESH_COOKIE, saved_refresh, path="/api/cms/auth")
    assert client.post("/api/cms/auth/refresh").status_code == 401


def test_cms_endpoints_reject_legacy_sites(
    test_settings: Settings,
    db_session_factory,
) -> None:
    client = _build_client(test_settings, db_session_factory)
    _login(client)

    # /api/cms/testimonials only accepts pattern ^falcao$
    for legacy_site in ("outro", "legado", "inexistente"):
        res = client.get(f"/api/cms/testimonials?site={legacy_site}")
        assert res.status_code == 422

    ok_testimonials = client.get("/api/cms/testimonials?site=falcao")
    assert ok_testimonials.status_code == 200

    # /api/cms/analytics only accepts SiteScope (which only has 'falcao')
    for legacy_site in ("outro", "legado", "inexistente"):
        res = client.get(f"/api/cms/analytics?site={legacy_site}")
        assert res.status_code == 422

    ok_analytics = client.get("/api/cms/analytics?site=falcao")
    assert ok_analytics.status_code == 200


def test_profile_photo_update_uses_upload_and_persists_in_session(
    test_settings: Settings,
    db_session_factory,
) -> None:
    import io

    from PIL import Image

    client = _build_client(test_settings, db_session_factory)
    _login(client)
    csrf_token = client.cookies.get(CSRF_COOKIE)
    assert csrf_token

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(201, 162, 74)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    upload_res = client.post(
        "/api/cms/uploads",
        files={"file": ("avatar.png", png_bytes, "image/png")},
        headers={"X-CSRF-Token": csrf_token, "Origin": ALLOWED_ORIGIN},
    )
    assert upload_res.status_code in (200, 201)
    uploaded_url = upload_res.json()["url"]
    assert uploaded_url

    photo_res = client.put(
        "/api/cms/auth/photo",
        json={"photo_url": uploaded_url},
        headers={"X-CSRF-Token": csrf_token, "Origin": ALLOWED_ORIGIN},
    )
    assert photo_res.status_code == 200
    assert photo_res.json()["photoUrl"] == uploaded_url

    me_res = client.get("/api/cms/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["photoUrl"] == uploaded_url
