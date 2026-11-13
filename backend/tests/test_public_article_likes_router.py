from fastapi.testclient import TestClient

from app.interfaces.api.v1.dependencies.services import get_article_like_service
from app.main import create_app


class FakeArticleLikeService:
    async def get_state(self, slug, visitor_hash, site):
        return False, 4 if slug == "artigo-edu" else None

    async def toggle(self, slug, visitor_hash, site):
        return (True, 5) if slug == "artigo-edu" else None


def create_test_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_article_like_service] = lambda: FakeArticleLikeService()
    return TestClient(app)


def test_toggle_like_sets_anonymous_cookie_and_returns_count() -> None:
    client = create_test_client()

    response = client.post(
        "/api/public/articles/artigo-edu/likes/toggle",
        headers={"host": "edu.localhost"},
    )

    assert response.status_code == 200
    assert response.json() == {"liked": True, "likes_count": 5}
    assert "talimpo_article_visitor=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


def test_get_like_state_reuses_cookie() -> None:
    client = create_test_client()
    client.cookies.set("talimpo_article_visitor", "4d36e96e-e325-11ce-bfc1-08002be10318")

    response = client.get("/api/public/articles/artigo-edu/likes")

    assert response.status_code == 200
    assert response.json() == {"liked": False, "likes_count": 4}
