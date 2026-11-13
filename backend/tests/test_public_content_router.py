from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.domain.entities.site import SiteScope
from app.domain.schemas.content import PublicArticleCardResponse
from app.interfaces.api.v1.dependencies.services import (
    get_public_content_service,
    get_site_settings_service,
)
from app.main import create_app


class FakePublicContentService:
    async def list_articles(self, *args, **kwargs) -> list[PublicArticleCardResponse]:
        return [
            PublicArticleCardResponse(
                id="agentes-ia",
                area="Estrategia",
                reading_time="8 min",
                title="Agentes de IA",
                thumbnail="/assets/article-1.png",
                href="/artigos/agentes-ia",
                slug="agentes-ia",
                first_published_at=datetime(2026, 7, 14, 12, 0, tzinfo=UTC),
            )
        ]

    async def get_article_by_slug(self, slug: str):
        return None

    async def list_cases(self) -> list:
        return []

    async def get_case_by_slug(self, slug: str):
        return None


class FakeSiteSettingsService:
    def __init__(self, articles_enabled: bool = True):
        self._articles_enabled = articles_enabled

    async def is_articles_enabled(self, site: SiteScope = SiteScope.FALCAO) -> bool:
        return self._articles_enabled


def create_test_client(articles_enabled: bool = True) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_public_content_service] = lambda: FakePublicContentService()
    app.dependency_overrides[get_site_settings_service] = lambda: FakeSiteSettingsService(
        articles_enabled
    )
    return TestClient(app)


def test_list_public_articles_returns_cache_header() -> None:
    client = create_test_client()

    response = client.get("/api/public/articles")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public, max-age=60, stale-while-revalidate=3600"
    assert response.headers["X-Cache"] == "BYPASS"
    assert response.json()[0]["slug"] == "agentes-ia"
    assert response.json()[0]["first_published_at"] == "2026-07-14T12:00:00Z"


def test_unknown_public_article_returns_404() -> None:
    client = create_test_client()

    response = client.get("/api/public/articles/inexistente")

    assert response.status_code == 404


def test_articles_toggle_off_returns_empty_list_without_cache() -> None:
    client = create_test_client(articles_enabled=False)

    response = client.get("/api/public/articles")

    assert response.status_code == 200
    assert response.json() == []
    assert response.headers["Cache-Control"] == "no-cache"


def test_articles_toggle_off_returns_404_on_detail() -> None:
    client = create_test_client(articles_enabled=False)

    response = client.get("/api/public/articles/agentes-ia")

    assert response.status_code == 404
