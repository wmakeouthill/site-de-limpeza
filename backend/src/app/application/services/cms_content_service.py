from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope
from app.domain.repositories.content_repository import ContentRepository
from app.domain.schemas.content import CmsContentListResponse, CmsContentSummaryResponse
from app.infrastructure.cache.public_cache import PublicCacheStore


class CmsContentService:
    def __init__(
        self,
        content_repository: ContentRepository,
        cache_store: PublicCacheStore | None = None,
    ):
        self.content_repository = content_repository
        self.cache_store = cache_store

    async def list_content(
        self,
        content_type: ContentType | None = None,
        status: ContentStatus | None = None,
        site: SiteScope = SiteScope.FALCAO,
    ) -> CmsContentListResponse:
        entries = await self.content_repository.list_by_status(content_type, status, site)
        items = [self._to_summary(entry) for entry in entries]
        return CmsContentListResponse(items=items, total=len(items))

    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        await self.content_repository.update_author_photo(author_email, photo_url)
        if self.cache_store:
            await self.cache_store.clear()

    @staticmethod
    def _to_summary(entry: ContentEntry) -> CmsContentSummaryResponse:
        return CmsContentSummaryResponse(
            id=entry.id,
            site=entry.site,
            content_type=entry.content_type,
            status=entry.status,
            slug=entry.slug,
            title=entry.title,
            excerpt=entry.excerpt or "",
            updated_at=entry.updated_at,
            published_at=entry.published_at,
            detail_label=CmsContentService._detail_label(entry),
        )

    @staticmethod
    def _detail_label(entry: ContentEntry) -> str:
        if entry.content_type == ContentType.ARTICLE and entry.article_detail:
            return entry.article_detail.categoria or entry.article_detail.area
        if entry.content_type == ContentType.GUIDE and entry.guide_detail:
            return entry.guide_detail.etiqueta or f"{entry.guide_detail.tempo_minutos} min"
        if entry.content_type == ContentType.CASE and entry.case_detail:
            return entry.case_detail.client_name
        return ""
