from fastapi.testclient import TestClient

from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import (
    get_cms_content_service,
    get_public_content_service,
    get_site_settings_service,
)
from app.main import create_app


def test_cms_health_requires_session_cookie() -> None:
    client = TestClient(create_app())

    response = client.get("/api/cms/health")

    assert response.status_code == 401


def test_cms_health_returns_user_when_authenticated() -> None:
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="editor@example.com",
        name="Editor",
        object_id="user-id",
    )
    client = TestClient(app)

    response = client.get("/api/cms/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "user": "editor@example.com"}


def test_public_content_route_stays_open_without_token() -> None:
    app = create_app()
    app.dependency_overrides[get_public_content_service] = lambda: FakePublicContentService()
    app.dependency_overrides[get_site_settings_service] = lambda: FakeSiteSettingsService()
    client = TestClient(app)

    response = client.get("/api/public/articles")

    assert response.status_code == 200


def test_cms_content_uses_authenticated_service() -> None:
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="editor@example.com",
        name="Editor",
        object_id="user-id",
    )
    app.dependency_overrides[get_cms_content_service] = lambda: FakeCmsContentService()
    client = TestClient(app)

    response = client.get("/api/cms/content?type=article&status=published")

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0}


class FakeSiteSettingsService:
    async def is_articles_enabled(self, site=None) -> bool:
        return True


class FakePublicContentService:
    async def list_articles(self, *args, **kwargs) -> list:
        return []


class FakeCmsContentService:
    async def list_content(self, content_type=None, status=None, site=None) -> dict:
        return {"items": [], "total": 0}
