from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.application.services.promocao_service import PromocaoService
from app.domain.schemas.promocao import PublicPromocaoRead
from app.interfaces.api.v1.dependencies.services import get_promocao_service

router = APIRouter(prefix="/api/public/promocoes", tags=["Public Promocoes"])

PromocaoServiceDependency = Annotated[PromocaoService, Depends(get_promocao_service)]


@router.get("/ativas", response_model=list[PublicPromocaoRead])
async def list_active_promotions(
    service: PromocaoServiceDependency,
    publico: str | None = Query(default=None),
) -> list[PublicPromocaoRead]:
    return await service.get_active_promotions(publico=publico)
