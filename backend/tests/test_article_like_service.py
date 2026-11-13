import pytest

from app.application.services.article_like_service import ArticleLikeService
from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope


class FakeContentRepository:
    def __init__(self, entry: ContentEntry | None):
        self.entry = entry

    async def find_published_by_slug(self, content_type, slug, site=SiteScope.FALCAO):
        if (
            self.entry
            and self.entry.content_type == content_type
            and self.entry.slug == slug
            and self.entry.site == site
            and self.entry.status == ContentStatus.PUBLISHED
        ):
            return self.entry
        return None


class FakeArticleLikeRepository:
    def __init__(self):
        self.visitors: set[tuple[str, str]] = set()

    async def get_state(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        return (article_id, visitor_hash) in self.visitors, len(self.visitors)

    async def toggle(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        key = (article_id, visitor_hash)
        if key in self.visitors:
            self.visitors.remove(key)
            return False, len(self.visitors)
        self.visitors.add(key)
        return True, len(self.visitors)


def published_article(site: SiteScope = SiteScope.FALCAO) -> ContentEntry:
    return ContentEntry(
        id="article-id",
        content_type=ContentType.ARTICLE,
        site=site,
        status=ContentStatus.PUBLISHED,
        slug="artigo-falcao",
        title="Artigo",
        created_by="editor",
        updated_by="editor",
    )


@pytest.mark.asyncio
async def test_toggle_persists_one_like_per_visitor() -> None:
    likes = FakeArticleLikeRepository()
    service = ArticleLikeService(FakeContentRepository(published_article()), likes)

    assert await service.toggle("artigo-falcao", "visitor-hash", SiteScope.FALCAO) == (
        True,
        1,
    )
    assert await service.toggle("artigo-falcao", "visitor-hash", SiteScope.FALCAO) == (
        False,
        0,
    )


@pytest.mark.asyncio
async def test_get_state_returns_none_when_article_not_found() -> None:
    service = ArticleLikeService(
        FakeContentRepository(published_article(SiteScope.FALCAO)),
        FakeArticleLikeRepository(),
    )

    assert await service.get_state("artigo-inexistente", "visitor-hash", SiteScope.FALCAO) is None
