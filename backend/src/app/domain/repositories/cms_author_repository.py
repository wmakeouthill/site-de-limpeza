from abc import ABC, abstractmethod

from app.domain.entities.cms_author import CmsAuthor


class CmsAuthorRepository(ABC):
    @abstractmethod
    async def upsert(self, email: str, name: str, photo_url: str = "") -> CmsAuthor:
        pass

    @abstractmethod
    async def list_authors(self) -> list[CmsAuthor]:
        """Lista autores ordenados por nome."""

    @abstractmethod
    async def find_by_email(self, email: str) -> CmsAuthor | None:
        pass

    @abstractmethod
    async def set_password_hash(self, email: str, password_hash: str, name: str = "") -> CmsAuthor:
        """Grava o hash da senha, criando o autor se ainda nao existir."""
