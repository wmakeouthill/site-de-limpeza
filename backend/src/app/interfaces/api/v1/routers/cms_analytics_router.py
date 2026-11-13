from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.application.services.analytics_service import AnalyticsService
from app.domain.entities.site import SiteScope
from app.domain.schemas.analytics import AnalyticsDashboard, AnalyticsPageList
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.cms_period import resolve_cms_period
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_analytics_service

router = APIRouter(prefix="/api/cms", tags=["CMS Analytics"])
CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
AnalyticsServiceDependency = Annotated[AnalyticsService, Depends(get_analytics_service)]


@router.get("/analytics", response_model=AnalyticsDashboard)
async def get_cms_analytics(
    user: CmsUserDependency,
    service: AnalyticsServiceDependency,
    # Sem site = os tres canais somados.
    site: SiteScope | None = None,
    days: Annotated[int, Query(ge=1, le=360)] = 30,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
) -> AnalyticsDashboard:
    _ = user
    try:
        period = resolve_cms_period(from_date=from_date, to_date=to_date, days=days)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    return await service.dashboard(
        site=site,
        days=days,
        start_at=period.start_at,
        end_at=period.end_at,
    )


@router.get("/analytics/pages", response_model=AnalyticsPageList)
async def get_cms_analytics_pages(
    user: CmsUserDependency,
    service: AnalyticsServiceDependency,
    site: SiteScope | None = None,
    days: Annotated[int, Query(ge=1, le=360)] = 30,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AnalyticsPageList:
    _ = user
    try:
        period = resolve_cms_period(from_date=from_date, to_date=to_date, days=days)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    return await service.pages(
        site=site,
        days=days,
        start_at=period.start_at,
        end_at=period.end_at,
        page=page,
        page_size=page_size,
    )
