from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.application.services.promocao_service import PromocaoService
from app.domain.schemas.promocao import (
    CmsPromocaoRead,
    PromocaoCreate,
    PromocaoUpdate,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_promocao_service

router = APIRouter(prefix="/api/cms/promocoes", tags=["CMS Promocoes"])

CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
PromocaoServiceDependency = Annotated[PromocaoService, Depends(get_promocao_service)]


@router.get("", response_model=list[CmsPromocaoRead])
async def list_cms_promocoes(
    user: CmsUserDependency,
    service: PromocaoServiceDependency,
) -> list[CmsPromocaoRead]:
    _ = user
    return await service.list_cms_promotions()


@router.post(
    "",
    response_model=CmsPromocaoRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_promocao(
    data: PromocaoCreate,
    user: CmsUserDependency,
    service: PromocaoServiceDependency,
) -> CmsPromocaoRead:
    return await service.create_promotion(data, user_email=user.email)


@router.put("/{promo_id}", response_model=CmsPromocaoRead)
async def update_promocao(
    promo_id: str,
    data: PromocaoUpdate,
    user: CmsUserDependency,
    service: PromocaoServiceDependency,
) -> CmsPromocaoRead:
    return await service.update_promotion(promo_id, data, user_email=user.email)


@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promocao(
    promo_id: str,
    user: CmsUserDependency,
    service: PromocaoServiceDependency,
) -> None:
    _ = user
    await service.delete_promotion(promo_id)
