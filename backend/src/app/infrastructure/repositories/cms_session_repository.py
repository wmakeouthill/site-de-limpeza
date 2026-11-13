from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.cms_session import CmsSession, utc_now


class SqlAlchemyCmsSessionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, cms_session: CmsSession) -> CmsSession:
        self._session.add(cms_session)
        await self._session.commit()
        await self._session.refresh(cms_session)
        return cms_session

    async def find_by_id(self, session_id: str) -> CmsSession | None:
        result = await self._session.execute(
            select(CmsSession).where(CmsSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def save(self, cms_session: CmsSession) -> CmsSession:
        cms_session.updated_at = utc_now()
        self._session.add(cms_session)
        await self._session.commit()
        await self._session.refresh(cms_session)
        return cms_session

    async def revoke(self, session_id: str) -> CmsSession | None:
        cms_session = await self.find_by_id(session_id)
        if cms_session is None:
            return None
        cms_session.revoke()
        await self._session.commit()
        await self._session.refresh(cms_session)
        return cms_session

    async def revoke_all_for_email(self, email: str) -> int:
        now = utc_now()
        result = await self._session.execute(
            update(CmsSession)
            .where(
                func.lower(CmsSession.user_email) == email.strip().lower(),
                CmsSession.revoked_at.is_(None),
            )
            .values(revoked_at=now, updated_at=now)
        )
        await self._session.commit()
        return result.rowcount
