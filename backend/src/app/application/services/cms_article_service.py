from urllib.parse import urlparse

from app.domain.entities.content import (
    ArticleDetail,
    ContentAsset,
    ContentEntry,
    ContentStatus,
    ContentType,
    generate_id,
    utc_now,
)
from app.domain.exceptions.content import ContentNotFoundError
from app.domain.repositories.content_repository import ContentRepository
from app.domain.schemas.content import ArticleCreate, ArticleUpdate, CmsArticleResponse
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.images import guess_image_mime
from app.infrastructure.indexnow import IndexNowClient
from app.infrastructure.security.cms_session import CmsUser


class CmsArticleService:
    def __init__(
        self,
        content_repository: ContentRepository,
        cache_store: PublicCacheStore | None = None,
        indexnow: IndexNowClient | None = None,
    ):
        self.content_repository = content_repository
        self.cache_store = cache_store
        self.indexnow = indexnow

    async def create_article(self, payload: ArticleCreate, user: CmsUser) -> CmsArticleResponse:
        author_name, author_image_url, author_email = self._resolve_author_for_create(payload, user)
        content_entry = ContentEntry(
            id=generate_id(),
            content_type=ContentType.ARTICLE,
            site=payload.site,
            status=ContentStatus.DRAFT,
            slug=payload.slug,
            title=payload.title,
            excerpt=payload.excerpt,
            body_markdown=payload.body_markdown,
            seo_title=payload.title,
            seo_description=payload.excerpt,
            created_by=user.email,
            updated_by=user.email,
            published_by=author_email,
            published_author_name=author_name,
            published_author_image_url=author_image_url or None,
        )
        content_entry.article_detail = self._build_article_detail(payload.article_detail, user)

        saved_entry = await self.content_repository.save(content_entry)
        return self._to_article_response(saved_entry)

    async def get_article(self, article_id: str) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        return self._to_article_response(content_entry)

    async def update_article(
        self,
        article_id: str,
        payload: ArticleUpdate,
        user: CmsUser,
    ) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED
        content_entry.slug = payload.slug
        content_entry.title = payload.title
        content_entry.excerpt = payload.excerpt
        content_entry.body_markdown = payload.body_markdown
        content_entry.seo_title = payload.title
        content_entry.seo_description = payload.excerpt
        content_entry.updated_by = user.email
        self._apply_author_from_payload(content_entry, payload)

        if not content_entry.article_detail:
            content_entry.article_detail = self._build_article_detail(payload.article_detail, user)
        else:
            self._update_article_detail(content_entry.article_detail, payload.article_detail, user)

        saved_entry = await self.content_repository.save(content_entry)
        if was_published or saved_entry.status == ContentStatus.PUBLISHED:
            await self._invalidate_public_cache(old_slug, saved_entry.slug)
        return self._to_article_response(saved_entry)

    async def publish_article(self, article_id: str, user: CmsUser) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        author_name = (content_entry.published_author_name or "").strip()
        if author_name:
            author_image_url = content_entry.published_author_image_url or ""
            published_by = content_entry.published_by or user.email
        else:
            author_name = user.name
            author_image_url = user.photo_url or ""
            published_by = user.email
        content_entry.publish(published_by, author_name, author_image_url)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(saved_entry.slug)
        return self._to_article_response(saved_entry)

    async def unpublish_article(self, article_id: str, user: CmsUser) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        old_slug = content_entry.slug
        content_entry.unpublish(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(old_slug)
        return self._to_article_response(saved_entry)

    async def archive_article(self, article_id: str, user: CmsUser) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        old_slug = content_entry.slug
        content_entry.archive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(old_slug)
        return self._to_article_response(saved_entry)

    async def unarchive_article(self, article_id: str, user: CmsUser) -> CmsArticleResponse:
        content_entry = await self._get_article_entry(article_id)
        content_entry.unarchive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        return self._to_article_response(saved_entry)

    async def delete_article(self, article_id: str) -> None:
        content_entry = await self._get_article_entry(article_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED
        await self.content_repository.delete(content_entry)
        if was_published:
            await self._invalidate_public_cache(old_slug)

    async def _get_article_entry(self, article_id: str) -> ContentEntry:
        content_entry = await self.content_repository.find_by_id(article_id)
        if not content_entry or content_entry.content_type != ContentType.ARTICLE:
            raise ContentNotFoundError("Artigo nao encontrado.")
        return content_entry

    @staticmethod
    def _resolve_author_for_create(
        payload: ArticleCreate,
        user: CmsUser,
    ) -> tuple[str, str, str | None]:
        author_name = (payload.author_name or "").strip()
        if author_name:
            return author_name, payload.author_image_url or "", payload.author_email
        return user.name, user.photo_url or "", user.email

    @staticmethod
    def _apply_author_from_payload(content_entry: ContentEntry, payload: ArticleUpdate) -> None:
        author_name = (payload.author_name or "").strip()
        if not author_name:
            return
        content_entry.published_author_name = author_name
        content_entry.published_author_image_url = payload.author_image_url or None
        content_entry.published_by = payload.author_email or None

    def _build_article_detail(self, payload, user: CmsUser) -> ArticleDetail:
        return ArticleDetail(
            categoria=getattr(payload, "categoria", "geral") or "geral",
            area=payload.area,
            reading_time=payload.reading_time,
            thumbnail_asset_id=payload.thumbnail_asset_id,
            thumbnail_asset=self._build_url_asset(
                payload.thumbnail_url,
                user,
                payload.thumbnail_asset_id,
            ),
            thumbnail_position_x=payload.thumbnail_position_x,
            thumbnail_position_y=payload.thumbnail_position_y,
            thumbnail_zoom=payload.thumbnail_zoom,
        )

    def _update_article_detail(self, detail: ArticleDetail, payload, user: CmsUser) -> None:
        if hasattr(payload, "categoria") and payload.categoria:
            detail.categoria = payload.categoria
        detail.area = payload.area
        detail.reading_time = payload.reading_time
        detail.thumbnail_asset_id = payload.thumbnail_asset_id
        detail.thumbnail_asset = self._build_url_asset(
            payload.thumbnail_url,
            user,
            payload.thumbnail_asset_id,
        )
        detail.thumbnail_position_x = payload.thumbnail_position_x
        detail.thumbnail_position_y = payload.thumbnail_position_y
        detail.thumbnail_zoom = payload.thumbnail_zoom

    @staticmethod
    def _build_url_asset(
        url: str,
        user: CmsUser,
        asset_id: str | None = None,
    ) -> ContentAsset | None:
        if not url or asset_id:
            return None

        parsed_url = urlparse(url)
        file_name = parsed_url.path.rsplit("/", 1)[-1] or "article-image"
        return ContentAsset(
            id=generate_id(),
            file_name=file_name,
            mime_type=guess_image_mime(file_name),
            size_bytes=0,
            storage_key=f"external/article-thumbnails/{generate_id()}/{file_name}",
            public_url=url,
            alt_text="",
            created_by=user.email,
        )

    async def _invalidate_public_cache(self, old_slug: str, new_slug: str | None = None) -> None:
        tags = {"home", "articles", "sitemap", f"article:{old_slug}"}
        if new_slug and new_slug != old_slug:
            tags.add(f"article:{new_slug}")
        if self.cache_store:
            await self.cache_store.invalidate_tags(tags)
        # Mesmo ponto em que o site muda: avisa os buscadores (o Google lê o sitemap).
        if self.indexnow:
            slugs = (slug for slug in (old_slug, new_slug) if slug)
            await self.indexnow.submit_paths(
                ["/", "/artigos", *(f"/artigos/{slug}" for slug in slugs)]
            )

    @staticmethod
    def _to_article_response(content_entry: ContentEntry) -> CmsArticleResponse:
        detail = content_entry.article_detail
        if not detail:
            raise ContentNotFoundError("Detalhes do artigo nao encontrados.")

        return CmsArticleResponse(
            id=content_entry.id,
            content_type=content_entry.content_type,
            site=content_entry.site,
            status=content_entry.status,
            slug=content_entry.slug,
            title=content_entry.title,
            excerpt=content_entry.excerpt or "",
            body_markdown=content_entry.body_markdown,
            cover_asset_id=content_entry.cover_asset_id,
            seo_title=content_entry.seo_title or "",
            seo_description=content_entry.seo_description or "",
            published_at=content_entry.published_at,
            updated_at=content_entry.updated_at or utc_now(),
            created_at=content_entry.created_at or utc_now(),
            created_by=content_entry.created_by,
            updated_by=content_entry.updated_by,
            published_by=content_entry.published_by,
            published_author_name=content_entry.published_author_name,
            published_author_image_url=content_entry.published_author_image_url,
            categoria=getattr(detail, "categoria", "geral") or "geral",
            area=detail.area,
            reading_time=detail.reading_time,
            thumbnail_asset_id=detail.thumbnail_asset_id,
            thumbnail_url=detail.thumbnail_asset.public_url if detail.thumbnail_asset else "",
            thumbnail_position_x=detail.thumbnail_position_x
            if detail.thumbnail_position_x is not None
            else 50,
            thumbnail_position_y=detail.thumbnail_position_y
            if detail.thumbnail_position_y is not None
            else 50,
            thumbnail_zoom=detail.thumbnail_zoom if detail.thumbnail_zoom is not None else 100,
        )
