from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.content import (
    ArticleDetail,
    CaseDetail,
    ContentEntry,
    ContentStatus,
    ContentType,
)
from app.domain.entities.guide import GuideProduto
from app.domain.entities.site import SiteScope
from app.domain.repositories.content_repository import ContentRepository


class SqlAlchemyContentRepository(ContentRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save(self, content_entry: ContentEntry) -> ContentEntry:
        self.session.add(content_entry)
        await self.session.commit()
        saved_entry = await self.find_by_id(content_entry.id)
        return saved_entry or content_entry

    async def find_by_id(self, content_entry_id: str) -> ContentEntry | None:
        result = await self.session.execute(
            self._base_query().where(ContentEntry.id == content_entry_id)
        )
        return result.scalar_one_or_none()

    async def find_published_by_slug(
        self,
        content_type: ContentType,
        slug: str,
        site: SiteScope = SiteScope.FALCAO,
    ) -> ContentEntry | None:
        result = await self.session.execute(
            self._base_query()
            .where(ContentEntry.site == site)
            .where(ContentEntry.content_type == content_type)
            .where(ContentEntry.status == ContentStatus.PUBLISHED)
            .where(ContentEntry.slug == slug)
        )
        return result.scalar_one_or_none()

    async def list_by_status(
        self,
        content_type: ContentType | None = None,
        status: ContentStatus | None = None,
        site: SiteScope = SiteScope.FALCAO,
    ) -> list[ContentEntry]:
        query = self._base_query().where(ContentEntry.site == site)
        if content_type:
            query = query.where(ContentEntry.content_type == content_type)
        if status:
            query = query.where(ContentEntry.status == status)

        result = await self.session.execute(query.order_by(ContentEntry.updated_at.desc()))
        return list(result.scalars().all())

    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        await self.session.execute(
            update(ContentEntry)
            .where(ContentEntry.published_by == author_email)
            .values(published_author_image_url=photo_url)
        )
        await self.session.commit()

    async def delete(self, content_entry: ContentEntry) -> None:
        await self.session.delete(content_entry)
        await self.session.commit()

    @staticmethod
    def _base_query():
        return select(ContentEntry).options(
            selectinload(ContentEntry.article_detail),
            selectinload(ContentEntry.article_detail).selectinload(ArticleDetail.thumbnail_asset),
            selectinload(ContentEntry.case_detail),
            selectinload(ContentEntry.case_detail).selectinload(CaseDetail.client_logo_asset),
            selectinload(ContentEntry.case_detail).selectinload(CaseDetail.company_icon_asset),
            selectinload(ContentEntry.case_detail).selectinload(CaseDetail.screenshot_asset),
            selectinload(ContentEntry.case_metrics),
            selectinload(ContentEntry.case_tags),
            selectinload(ContentEntry.guide_detail),
            selectinload(ContentEntry.guide_produtos).selectinload(GuideProduto.produto),
        )
