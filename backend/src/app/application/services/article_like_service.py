from app.domain.entities.content import ContentType
from app.domain.entities.site import SiteScope
from app.domain.repositories.article_like_repository import ArticleLikeRepository
from app.domain.repositories.content_repository import ContentRepository


class ArticleLikeService:
    def __init__(
        self, content_repository: ContentRepository, article_like_repository: ArticleLikeRepository
    ) -> None:
        self.content_repository = content_repository
        self.article_like_repository = article_like_repository

    async def get_state(
        self, slug: str, visitor_hash: str, site: SiteScope
    ) -> tuple[bool, int] | None:
        article = await self.content_repository.find_published_by_slug(
            ContentType.ARTICLE, slug, site
        )
        return (
            await self.article_like_repository.get_state(article.id, visitor_hash)
            if article
            else None
        )

    async def toggle(
        self, slug: str, visitor_hash: str, site: SiteScope
    ) -> tuple[bool, int] | None:
        article = await self.content_repository.find_published_by_slug(
            ContentType.ARTICLE, slug, site
        )
        return (
            await self.article_like_repository.toggle(article.id, visitor_hash) if article else None
        )
