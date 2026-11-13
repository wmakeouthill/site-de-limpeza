from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.campaign_source_link import CampaignSourceLink


def _normalize_redirect_match(url: str) -> str:
    raw = (url or "").strip().lower()
    if not raw:
        return ""
    if "://" in raw:
        raw = raw.split("://", 1)[1]
    if raw.startswith("www."):
        raw = raw[4:]
    return raw.split("?", 1)[0].split("#", 1)[0].rstrip("/")


class SqlAlchemyCampaignSourceLinkRepository:
    """Persistência local das fichas de origem de campanha."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def find_by_identifier(self, identifier: str) -> CampaignSourceLink | None:
        return await self.session.get(CampaignSourceLink, identifier)

    async def find_by_redirect_url(self, redirect_url: str) -> CampaignSourceLink | None:
        if not redirect_url:
            return None
        result = await self.session.execute(
            select(CampaignSourceLink).where(CampaignSourceLink.redirect_url == redirect_url)
        )
        found = result.scalar_one_or_none()
        if found is not None:
            return found

        norm_target = _normalize_redirect_match(redirect_url)
        if not norm_target:
            return None
        all_links = await self.list_all()
        for link in all_links:
            if not link.redirect_url:
                continue
            norm_link = _normalize_redirect_match(link.redirect_url)
            if (
                norm_link == norm_target
                or ("/" not in norm_target and norm_link.split("/")[0] == norm_target)
                or ("/" not in norm_link and norm_target.split("/")[0] == norm_link)
            ):
                return link
        return None

    async def list_all(self) -> list[CampaignSourceLink]:
        result = await self.session.execute(
            select(CampaignSourceLink).order_by(CampaignSourceLink.identifier)
        )
        return list(result.scalars())

    async def upsert(self, link: CampaignSourceLink) -> CampaignSourceLink:
        existing = await self.find_by_identifier(link.identifier)
        if existing is None:
            self.session.add(link)
            saved = link
        else:
            existing.title = link.title
            existing.source_url = link.source_url
            existing.thumbnail_url = link.thumbnail_url
            existing.redirect_url = link.redirect_url
            saved = existing
        try:
            await self.session.commit()
            await self.session.refresh(saved)
            return saved
        except Exception:
            await self.session.rollback()
            raise

    async def delete(self, identifier: str) -> bool:
        link = await self.find_by_identifier(identifier)
        if link is None:
            return False
        try:
            await self.session.delete(link)
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise
