from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.services.site_settings_service import SiteSettingsService
from app.domain.schemas.site_settings import SiteSettingsResponse, SiteSettingsUpdate
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_site_settings_service

router = APIRouter(prefix="/api/cms", tags=["CMS Settings"])

CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
SiteSettingsServiceDependency = Annotated[
    SiteSettingsService,
    Depends(get_site_settings_service),
]


@router.get("/site-settings", response_model=SiteSettingsResponse)
@router.get("/settings", response_model=SiteSettingsResponse)
async def get_site_settings(
    user: CmsUserDependency,
    service: SiteSettingsServiceDependency,
) -> SiteSettingsResponse:
    _ = user
    return await service.get_settings()


@router.put("/site-settings", response_model=SiteSettingsResponse)
@router.put("/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    payload: SiteSettingsUpdate,
    user: CmsUserDependency,
    service: SiteSettingsServiceDependency,
) -> SiteSettingsResponse:
    return await service.update_settings(payload, user)

