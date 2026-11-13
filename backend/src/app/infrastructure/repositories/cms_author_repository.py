from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.cms_author import CmsAuthor, utc_now
from app.domain.repositories.cms_author_repository import CmsAuthorRepository


class SqlAlchemyCmsAuthorRepository(CmsAuthorRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def upsert(self, email: str, name: str, photo_url: str = "") -> CmsAuthor:
        normalized_email = email.strip().lower()
        result = await self.session.execute(
            select(CmsAuthor).where(CmsAuthor.email == normalized_email)
        )
        author = result.scalar_one_or_none()
        now = utc_now()

        if author is None:
            author = CmsAuthor(
                email=normalized_email,
                name=name.strip(),
                photo_url=photo_url or "",
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            )
            self.session.add(author)
        else:
            author.name = name.strip() or author.name
            if photo_url:
                author.photo_url = photo_url
            author.last_seen_at = now
            author.updated_at = now

        await self.session.commit()
        await self.session.refresh(author)
        return author

    async def list_authors(self) -> list[CmsAuthor]:
        result = await self.session.execute(select(CmsAuthor).order_by(CmsAuthor.name.asc()))
        return list(result.scalars().all())

    async def find_by_email(self, email: str) -> CmsAuthor | None:
        result = await self.session.execute(
            select(CmsAuthor).where(CmsAuthor.email == email.strip().lower())
        )
        return result.scalar_one_or_none()

    async def set_password_hash(self, email: str, password_hash: str, name: str = "") -> CmsAuthor:
        author = await self.upsert(email, name)
        author.password_hash = password_hash
        await self.session.commit()
        await self.session.refresh(author)
        return author
