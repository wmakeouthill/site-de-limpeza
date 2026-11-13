from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.application.services.catalog_service import CatalogService
from app.domain.exceptions.catalog import (
    DepartmentNotFoundError,
    DuplicateSlugError,
    InvalidOfferError,
    KitNotFoundError,
    ProductInUseConflictError,
    ProductNotFoundError,
)
from app.domain.schemas.catalog import (
    CmsDepartamentoResponse,
    CmsKitResponse,
    CmsProdutoResponse,
    DepartamentoCreate,
    DepartamentoUpdate,
    KitCreate,
    ProdutoCreate,
    ProdutoUpdate,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_catalog_service

router = APIRouter(prefix="/api/cms", tags=["CMS Catalog"])

CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
CatalogServiceDependency = Annotated[CatalogService, Depends(get_catalog_service)]


# ==============================================================================
# DEPARTAMENTOS
# ==============================================================================


@router.get("/departamentos", response_model=list[CmsDepartamentoResponse])
async def list_cms_departamentos(
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> list[CmsDepartamentoResponse]:
    _ = user
    return await service.list_cms_departamentos()


@router.post(
    "/departamentos",
    response_model=CmsDepartamentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_departamento(
    data: DepartamentoCreate,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsDepartamentoResponse:
    try:
        return await service.create_departamento(data, user_email=user.email)
    except DuplicateSlugError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.put("/departamentos/{departamento_id}", response_model=CmsDepartamentoResponse)
async def update_departamento(
    departamento_id: str,
    data: DepartamentoUpdate,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsDepartamentoResponse:
    try:
        return await service.update_departamento(
            departamento_id, data, user_email=user.email
        )
    except DepartmentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateSlugError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/departamentos/{departamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_departamento(
    departamento_id: str,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> None:
    _ = user
    try:
        await service.delete_departamento(departamento_id)
    except DepartmentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ProductInUseConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


# ==============================================================================
# PRODUTOS
# ==============================================================================


@router.get("/produtos", response_model=list[CmsProdutoResponse])
async def list_cms_produtos(
    user: CmsUserDependency,
    service: CatalogServiceDependency,
    departamento_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    oferta: bool = Query(default=False),
    embalagem_grande: bool = Query(default=False),
    marca: str | None = Query(default=None),
    ordem: str | None = Query(default=None),
) -> list[CmsProdutoResponse]:
    _ = user
    return await service.list_cms_produtos(
        departamento_id=departamento_id,
        q=q,
        apenas_ofertas=oferta,
        apenas_embalagem_grande=embalagem_grande,
        marca=marca,
        ordem=ordem,
    )


@router.get("/produtos/{produto_id}", response_model=CmsProdutoResponse)
async def get_cms_produto(
    produto_id: str,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsProdutoResponse:
    _ = user
    try:
        return await service.get_cms_produto_by_id(produto_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post(
    "/produtos",
    response_model=CmsProdutoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_produto(
    data: ProdutoCreate,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsProdutoResponse:
    try:
        return await service.create_produto(data, user_email=user.email)
    except DepartmentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateSlugError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (InvalidOfferError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.put("/produtos/{produto_id}", response_model=CmsProdutoResponse)
async def update_produto(
    produto_id: str,
    data: ProdutoUpdate,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsProdutoResponse:
    try:
        return await service.update_produto(produto_id, data, user_email=user.email)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DepartmentNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateSlugError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (InvalidOfferError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.delete("/produtos/{produto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_produto(
    produto_id: str,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> None:
    _ = user
    try:
        await service.delete_produto(produto_id)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ProductInUseConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


# ==============================================================================
# KITS
# ==============================================================================


@router.get("/kits", response_model=list[CmsKitResponse])
async def list_cms_kits(
    user: CmsUserDependency,
    service: CatalogServiceDependency,
    publico: str | None = Query(default=None),
) -> list[CmsKitResponse]:
    _ = user
    return await service.list_cms_kits(publico=publico)


@router.post(
    "/kits",
    response_model=CmsKitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_kit(
    data: KitCreate,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> CmsKitResponse:
    try:
        return await service.create_kit(data, user_email=user.email)
    except ProductNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateSlugError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/kits/{kit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kit(
    kit_id: str,
    user: CmsUserDependency,
    service: CatalogServiceDependency,
) -> None:
    _ = user
    try:
        await service.delete_kit(kit_id)
    except KitNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
