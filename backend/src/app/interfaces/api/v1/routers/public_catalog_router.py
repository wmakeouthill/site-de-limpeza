from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.application.services.catalog_service import CatalogService
from app.domain.exceptions.catalog import ProductNotFoundError
from app.domain.schemas.catalog import (
    PublicDepartamentoResponse,
    PublicKitResponse,
    PublicProdutoResponse,
)
from app.interfaces.api.v1.dependencies.services import get_catalog_service

router = APIRouter(prefix="/api/public", tags=["Public Catalog"])

CatalogServiceDependency = Annotated[CatalogService, Depends(get_catalog_service)]


@router.get("/departamentos", response_model=list[PublicDepartamentoResponse])
async def list_public_departamentos(
    service: CatalogServiceDependency,
) -> list[PublicDepartamentoResponse]:
    return await service.list_public_departamentos()


@router.get("/produtos", response_model=list[PublicProdutoResponse])
async def list_public_produtos(
    service: CatalogServiceDependency,
    departamento: str | None = Query(default=None),
    departamento_slug: str | None = Query(default=None),
    q: str | None = Query(default=None),
    oferta: bool = Query(default=False),
    embalagem_grande: bool = Query(default=False),
    marca: str | None = Query(default=None),
    ordem: str | None = Query(default=None),
) -> list[PublicProdutoResponse]:
    dept_slug = departamento_slug or departamento
    return await service.list_public_produtos(
        departamento_slug=dept_slug,
        q=q,
        apenas_ofertas=oferta,
        apenas_embalagem_grande=embalagem_grande,
        marca=marca,
        ordem=ordem,
    )


@router.get("/produtos/{slug}", response_model=PublicProdutoResponse)
async def get_public_produto(
    slug: str,
    service: CatalogServiceDependency,
) -> PublicProdutoResponse:
    try:
        return await service.get_public_produto_by_slug(slug)
    except ProductNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
        ) from exc


@router.get("/kits", response_model=list[PublicKitResponse])
async def list_public_kits(
    service: CatalogServiceDependency,
    publico: str | None = Query(default=None),
) -> list[PublicKitResponse]:
    return await service.list_public_kits(publico=publico)
