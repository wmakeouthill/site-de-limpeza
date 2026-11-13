from abc import ABC, abstractmethod

from app.domain.entities.site_settings import SiteSettings


class SiteSettingsRepository(ABC):
    @abstractmethod
    async def get(self) -> SiteSettings | None:
        pass

    @abstractmethod
    async def save(self, entity: SiteSettings) -> SiteSettings:
        pass
