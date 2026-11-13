from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.content import ArticleLike, ContentEntry
from app.domain.repositories.article_like_repository import ArticleLikeRepository


class SqlAlchemyArticleLikeRepository(ArticleLikeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_state(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        liked = await self.session.scalar(
            select(func.count(ArticleLike.id)).where(
                ArticleLike.content_entry_id == article_id,
                ArticleLike.visitor_id_hash == visitor_hash,
            )
        )
        return bool(liked), await self._count(article_id)

    async def toggle(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        try:
            await self.session.execute(
                select(ContentEntry.id).where(ContentEntry.id == article_id).with_for_update()
            )
            existing = await self.session.scalar(
                select(ArticleLike).where(
                    ArticleLike.content_entry_id == article_id,
                    ArticleLike.visitor_id_hash == visitor_hash,
                )
            )
            if existing:
                await self.session.execute(delete(ArticleLike).where(ArticleLike.id == existing.id))
                liked = False
            else:
                self.session.add(
                    ArticleLike(content_entry_id=article_id, visitor_id_hash=visitor_hash)
                )
                liked = True
            await self.session.flush()
            count = await self._count(article_id)
            await self.session.commit()
            return liked, count
        except Exception:
            await self.session.rollback()
            raise

    async def _count(self, article_id: str) -> int:
        count = await self.session.scalar(
            select(func.count(ArticleLike.id)).where(ArticleLike.content_entry_id == article_id)
        )
        return int(count or 0)
