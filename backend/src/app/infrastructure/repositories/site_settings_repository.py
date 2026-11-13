from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.site_settings import SITE_SETTINGS_ID, SiteSettings, utc_now
from app.domain.repositories.site_settings_repository import SiteSettingsRepository


class SqlAlchemySiteSettingsRepository(SiteSettingsRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self) -> SiteSettings | None:
        result = await self.session.execute(
            select(SiteSettings).where(SiteSettings.id == SITE_SETTINGS_ID)
        )
        return result.scalar_one_or_none()

    async def save(self, entity: SiteSettings) -> SiteSettings:
        entity.id = SITE_SETTINGS_ID
        entity.updated_at = utc_now()
        merged = await self.session.merge(entity)
        await self.session.commit()
        return merged
