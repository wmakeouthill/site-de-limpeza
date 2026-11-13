from abc import ABC, abstractmethod

from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope


class ContentRepository(ABC):
    @abstractmethod
    async def save(self, content_entry: ContentEntry) -> ContentEntry:
        pass

    @abstractmethod
    async def find_by_id(self, content_entry_id: str) -> ContentEntry | None:
        pass

    @abstractmethod
    async def find_published_by_slug(
        self,
        content_type: ContentType,
        slug: str,
        site: SiteScope = SiteScope.FALCAO,
    ) -> ContentEntry | None:
        pass

    @abstractmethod
    async def list_by_status(
        self,
        content_type: ContentType | None = None,
        status: ContentStatus | None = None,
        site: SiteScope = SiteScope.FALCAO,
    ) -> list[ContentEntry]:
        pass

    @abstractmethod
    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        pass

    @abstractmethod
    async def delete(self, content_entry: ContentEntry) -> None:
        pass
