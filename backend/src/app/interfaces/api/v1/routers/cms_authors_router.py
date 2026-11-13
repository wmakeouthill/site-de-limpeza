from typing import Annotated

from fastapi import APIRouter, Depends

from app.application.services.cms_author_service import CmsAuthorService
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_cms_author_service

router = APIRouter(prefix="/api/cms", tags=["CMS Authors"])

CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
CmsAuthorServiceDependency = Annotated[CmsAuthorService, Depends(get_cms_author_service)]


@router.get("/authors")
async def list_cms_authors(
    user: CmsUserDependency,
    service: CmsAuthorServiceDependency,
) -> dict[str, list[dict[str, str]]]:
    _ = user
    return {"items": await service.list_authors()}
