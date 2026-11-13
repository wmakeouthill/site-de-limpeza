from urllib.parse import urlparse

from app.domain.entities.content import (
    CaseDetail,
    CaseMetric,
    CaseTag,
    ContentAsset,
    ContentEntry,
    ContentStatus,
    ContentType,
    generate_id,
    utc_now,
)
from app.domain.exceptions.content import ContentNotFoundError, InvalidContentPublicationError
from app.domain.repositories.content_repository import ContentRepository
from app.domain.schemas.content import (
    CaseCreate,
    CaseDetailInput,
    CaseMetricInput,
    CaseTagInput,
    CaseUpdate,
    CmsCaseResponse,
    CmsCaseTagResponse,
)
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.images import guess_image_mime
from app.infrastructure.indexnow import IndexNowClient
from app.infrastructure.security.cms_session import CmsUser


class CmsCaseService:
    def __init__(
        self,
        content_repository: ContentRepository,
        cache_store: PublicCacheStore | None = None,
        indexnow: IndexNowClient | None = None,
    ):
        self.content_repository = content_repository
        self.cache_store = cache_store
        self.indexnow = indexnow

    async def create_case(self, payload: CaseCreate, user: CmsUser) -> CmsCaseResponse:
        self._ensure_unique_tags(payload.tags)
        content_entry = ContentEntry(
            id=generate_id(),
            content_type=ContentType.CASE,
            status=ContentStatus.DRAFT,
            site=payload.site,
            slug=payload.slug,
            title=payload.title,
            excerpt=payload.excerpt,
            body_markdown=payload.body_markdown,
            seo_title=payload.title,
            seo_description=payload.excerpt,
            created_by=user.email,
            updated_by=user.email,
        )
        content_entry.case_detail = self._build_case_detail(payload.case_detail, user)
        self._sync_case_tags(content_entry.case_tags, payload.tags)

        saved_entry = await self.content_repository.save(content_entry)
        return self._to_case_response(saved_entry)

    async def get_case(self, case_id: str) -> CmsCaseResponse:
        content_entry = await self._get_case_entry(case_id)
        return self._to_case_response(content_entry)

    async def update_case(
        self,
        case_id: str,
        payload: CaseUpdate,
        user: CmsUser,
    ) -> CmsCaseResponse:
        self._ensure_unique_tags(payload.tags)
        content_entry = await self._get_case_entry(case_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED
        content_entry.slug = payload.slug
        content_entry.title = payload.title
        content_entry.excerpt = payload.excerpt
        content_entry.body_markdown = payload.body_markdown
        content_entry.seo_title = payload.title
        content_entry.seo_description = payload.excerpt
        content_entry.updated_by = user.email

        if not content_entry.case_detail:
            content_entry.case_detail = self._build_case_detail(payload.case_detail, user)
        else:
            self._update_case_detail(content_entry.case_detail, payload.case_detail, user)

        self._sync_case_tags(content_entry.case_tags, payload.tags)

        saved_entry = await self.content_repository.save(content_entry)
        if was_published or saved_entry.status == ContentStatus.PUBLISHED:
            await self._invalidate_public_cache(old_slug, saved_entry.slug)
        return self._to_case_response(saved_entry)

    async def publish_case(self, case_id: str, user: CmsUser) -> CmsCaseResponse:
        content_entry = await self._get_case_entry(case_id)
        content_entry.publish(user.email, user.name, user.photo_url)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(saved_entry.slug)
        return self._to_case_response(saved_entry)

    async def unpublish_case(self, case_id: str, user: CmsUser) -> CmsCaseResponse:
        content_entry = await self._get_case_entry(case_id)
        old_slug = content_entry.slug
        content_entry.unpublish(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(old_slug)
        return self._to_case_response(saved_entry)

    async def archive_case(self, case_id: str, user: CmsUser) -> CmsCaseResponse:
        content_entry = await self._get_case_entry(case_id)
        old_slug = content_entry.slug
        content_entry.archive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(old_slug)
        return self._to_case_response(saved_entry)

    async def unarchive_case(self, case_id: str, user: CmsUser) -> CmsCaseResponse:
        content_entry = await self._get_case_entry(case_id)
        content_entry.unarchive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        return self._to_case_response(saved_entry)

    async def delete_case(self, case_id: str) -> None:
        content_entry = await self._get_case_entry(case_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED
        await self.content_repository.delete(content_entry)
        if was_published:
            await self._invalidate_public_cache(old_slug)

    async def _get_case_entry(self, case_id: str) -> ContentEntry:
        content_entry = await self.content_repository.find_by_id(case_id)
        if not content_entry or content_entry.content_type != ContentType.CASE:
            raise ContentNotFoundError("Case nao encontrado.")
        return content_entry

    def _build_case_detail(self, payload: CaseDetailInput, user: CmsUser) -> CaseDetail:
        return CaseDetail(
            topic=payload.topic,
            client_name=payload.topic,
            screenshot_asset_id=payload.screenshot_asset_id,
            screenshot_asset=self._build_url_asset(
                payload.screenshot_url,
                user,
                "screenshot",
                payload.screenshot_asset_id,
            ),
            screenshot_position_x=payload.screenshot_position_x,
            screenshot_position_y=payload.screenshot_position_y,
            screenshot_zoom=payload.screenshot_zoom,
        )

    def _update_case_detail(
        self,
        detail: CaseDetail,
        payload: CaseDetailInput,
        user: CmsUser,
    ) -> None:
        detail.topic = payload.topic
        detail.client_name = payload.topic
        detail.screenshot_asset_id = payload.screenshot_asset_id
        detail.screenshot_asset = self._build_url_asset(
            payload.screenshot_url,
            user,
            "screenshot",
            payload.screenshot_asset_id,
        )
        detail.screenshot_position_x = payload.screenshot_position_x
        detail.screenshot_position_y = payload.screenshot_position_y
        detail.screenshot_zoom = payload.screenshot_zoom

    @staticmethod
    def _build_case_metrics(payload: list[CaseMetricInput]) -> list[CaseMetric]:
        return [
            CaseMetric(
                id=generate_id(),
                prefix=metric.prefix,
                value=metric.value,
                label=metric.label,
                sort_order=index,
            )
            for index, metric in enumerate(payload)
        ]

    @staticmethod
    def _build_case_tags(payload: list[CaseTagInput]) -> list[CaseTag]:
        return [
            CaseTag(
                id=generate_id(),
                label=tag.label,
                sort_order=index,
            )
            for index, tag in enumerate(payload)
        ]

    @staticmethod
    def _sync_case_metrics(
        current_metrics: list[CaseMetric],
        payload: list[CaseMetricInput],
    ) -> None:
        for index, metric_payload in enumerate(payload):
            if index < len(current_metrics):
                metric = current_metrics[index]
                metric.prefix = metric_payload.prefix
                metric.value = metric_payload.value
                metric.label = metric_payload.label
                metric.sort_order = index
            else:
                current_metrics.append(
                    CaseMetric(
                        id=generate_id(),
                        prefix=metric_payload.prefix,
                        value=metric_payload.value,
                        label=metric_payload.label,
                        sort_order=index,
                    ),
                )

        del current_metrics[len(payload) :]

    @staticmethod
    def _sync_case_tags(current_tags: list[CaseTag], payload: list[CaseTagInput]) -> None:
        for index, tag_payload in enumerate(payload):
            if index < len(current_tags):
                tag = current_tags[index]
                tag.label = tag_payload.label
                tag.sort_order = index
            else:
                current_tags.append(
                    CaseTag(
                        id=generate_id(),
                        label=tag_payload.label,
                        sort_order=index,
                    ),
                )

        del current_tags[len(payload) :]

    @staticmethod
    def _build_url_asset(
        url: str,
        user: CmsUser,
        asset_kind: str,
        asset_id: str | None = None,
    ) -> ContentAsset | None:
        if not url or asset_id:
            return None

        parsed_url = urlparse(url)
        file_name = parsed_url.path.rsplit("/", 1)[-1] or asset_kind
        return ContentAsset(
            id=generate_id(),
            file_name=file_name,
            mime_type=guess_image_mime(file_name),
            size_bytes=0,
            storage_key=f"external/case-{asset_kind}/{generate_id()}/{file_name}",
            public_url=url,
            alt_text="",
            created_by=user.email,
        )

    async def _invalidate_public_cache(self, old_slug: str, new_slug: str | None = None) -> None:
        tags = {"home", "cases", "sitemap", f"case:{old_slug}"}
        if new_slug and new_slug != old_slug:
            tags.add(f"case:{new_slug}")
        if self.cache_store:
            await self.cache_store.invalidate_tags(tags)
        # Mesmo ponto em que o site muda: avisa os buscadores (o Google lê o sitemap).
        if self.indexnow:
            slugs = (slug for slug in (old_slug, new_slug) if slug)
            await self.indexnow.submit_paths(["/", "/guias", *(f"/guias/{slug}" for slug in slugs)])

    @staticmethod
    def _ensure_unique_tags(tags: list[CaseTagInput]) -> None:
        normalized_labels = [tag.label.strip().lower() for tag in tags]
        if len(normalized_labels) != len(set(normalized_labels)):
            raise InvalidContentPublicationError("Tags duplicadas nao sao permitidas.")

    @staticmethod
    def _to_case_response(content_entry: ContentEntry) -> CmsCaseResponse:
        detail = content_entry.case_detail
        if not detail:
            raise ContentNotFoundError("Detalhes do case nao encontrados.")

        return CmsCaseResponse(
            id=content_entry.id,
            site=content_entry.site,
            content_type=content_entry.content_type,
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
            topic=detail.topic,
            screenshot_asset_id=detail.screenshot_asset_id,
            screenshot_url=detail.screenshot_asset.public_url if detail.screenshot_asset else "",
            screenshot_position_x=detail.screenshot_position_x
            if detail.screenshot_position_x is not None
            else 50,
            screenshot_position_y=detail.screenshot_position_y
            if detail.screenshot_position_y is not None
            else 50,
            screenshot_zoom=detail.screenshot_zoom if detail.screenshot_zoom is not None else 100,
            tags=[
                CmsCaseTagResponse(label=tag.label, sort_order=tag.sort_order)
                for tag in content_entry.case_tags
            ],
        )
