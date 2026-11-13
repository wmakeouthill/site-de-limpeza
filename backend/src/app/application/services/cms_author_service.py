import asyncio

from app.domain.entities.cms_author import CmsAuthor
from app.domain.repositories.cms_author_repository import CmsAuthorRepository
from app.infrastructure.security.password_hashing import hash_password, verify_password

MIN_PASSWORD_LENGTH = 12


class WeakPasswordError(ValueError):
    pass


class CmsAuthorService:
    def __init__(self, repository: CmsAuthorRepository):
        self._repository = repository

    async def upsert(self, email: str, name: str, photo_url: str = "") -> dict[str, str]:
        author = await self._repository.upsert(email, name, photo_url)
        return self._to_item(author)

    async def list_authors(self) -> list[dict[str, str]]:
        authors = await self._repository.list_authors()
        return [self._to_item(author) for author in authors]

    async def authenticate(self, email: str, password: str) -> CmsAuthor | None:
        author = await self._repository.find_by_email(email)
        password_hash = author.password_hash if author else ""
        # argon2 e CPU-bound (~50 ms): fora do event loop.
        if not await asyncio.to_thread(verify_password, password, password_hash):
            return None
        return author

    async def set_password(self, email: str, password: str, name: str = "") -> CmsAuthor:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise WeakPasswordError(
                f"A senha precisa ter pelo menos {MIN_PASSWORD_LENGTH} caracteres."
            )
        password_hash = await asyncio.to_thread(hash_password, password)
        return await self._repository.set_password_hash(email, password_hash, name)

    @staticmethod
    def _to_item(author) -> dict[str, str]:
        return {
            "email": author.email,
            "name": author.name,
            "photoUrl": author.photo_url or "",
        }
