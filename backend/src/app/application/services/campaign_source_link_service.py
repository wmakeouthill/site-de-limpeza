from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.schemas.campaign_source_link import CampaignSourceLinkResponse
from app.infrastructure.repositories.campaign_source_link_repository import (
    SqlAlchemyCampaignSourceLinkRepository,
)


class CampaignSourceLinkService:
    """Administra fichas de origem no banco local de analytics."""

    def __init__(self, repository: SqlAlchemyCampaignSourceLinkRepository) -> None:
        self._repository = repository

    async def list_all(self) -> list[CampaignSourceLinkResponse]:
        return [_response(link) for link in await self._repository.list_all()]

    async def upsert(
        self,
        identifier: str,
        *,
        title: str,
        source_url: str,
        thumbnail_url: str,
        redirect_url: str,
    ) -> CampaignSourceLinkResponse:
        link = await self._repository.upsert(
            CampaignSourceLink(
                identifier=identifier,
                title=title,
                source_url=source_url,
                thumbnail_url=thumbnail_url,
                redirect_url=redirect_url,
            )
        )
        return _response(link)

    async def delete(self, identifier: str) -> bool:
        return await self._repository.delete(identifier)


def _response(link: CampaignSourceLink) -> CampaignSourceLinkResponse:
    return CampaignSourceLinkResponse(
        identifier=link.identifier,
        title=link.title,
        source_url=link.source_url,
        thumbnail_url=link.thumbnail_url,
        redirect_url=link.redirect_url,
    )
