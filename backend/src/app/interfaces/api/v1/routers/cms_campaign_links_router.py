from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.application.services.campaign_source_link_service import CampaignSourceLinkService
from app.domain.schemas.campaign_source_link import (
    CampaignSourceLinkResponse,
    CampaignSourceLinkUpsert,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_campaign_source_link_service

router = APIRouter(prefix="/api/cms", tags=["CMS Campaign Links"])
CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
CampaignSourceLinkServiceDependency = Annotated[
    CampaignSourceLinkService,
    Depends(get_campaign_source_link_service),
]
CampaignIdentifier = Annotated[
    str,
    Path(pattern=r"^[a-z0-9][a-z0-9._-]{0,79}$"),
]


@router.get("/campaign-links", response_model=list[CampaignSourceLinkResponse])
async def list_campaign_links(
    user: CmsUserDependency,
    service: CampaignSourceLinkServiceDependency,
) -> list[CampaignSourceLinkResponse]:
    _ = user
    return await service.list_all()


@router.put("/campaign-links/{identifier}", response_model=CampaignSourceLinkResponse)
async def upsert_campaign_link(
    identifier: CampaignIdentifier,
    payload: CampaignSourceLinkUpsert,
    user: CmsUserDependency,
    service: CampaignSourceLinkServiceDependency,
) -> CampaignSourceLinkResponse:
    _ = user
    return await service.upsert(identifier, **payload.model_dump())


@router.delete("/campaign-links/{identifier}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign_link(
    identifier: CampaignIdentifier,
    user: CmsUserDependency,
    service: CampaignSourceLinkServiceDependency,
) -> None:
    _ = user
    if not await service.delete(identifier):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Link de campanha não encontrado."
        )
