from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.application.services.testimonial_service import TestimonialService
from app.domain.schemas.testimonial import (
    TestimonialReorderRequest,
    TestimonialResponse,
    TestimonialUpsert,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_testimonial_service

router = APIRouter(prefix="/api/cms", tags=["CMS Testimonials"])
CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
TestimonialServiceDependency = Annotated[
    TestimonialService,
    Depends(get_testimonial_service),
]
TestimonialSiteQuery = Annotated[str, Query(pattern=r"^(falcao|talimpo)$")]


@router.get("/testimonials", response_model=list[TestimonialResponse])
async def list_testimonials(
    user: CmsUserDependency,
    service: TestimonialServiceDependency,
    site: TestimonialSiteQuery = "falcao",
) -> list[TestimonialResponse]:
    _ = user
    return await service.list_by_site(site)


@router.post(
    "/testimonials",
    response_model=TestimonialResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_testimonial(
    payload: TestimonialUpsert,
    user: CmsUserDependency,
    service: TestimonialServiceDependency,
) -> TestimonialResponse:
    return await service.create(payload, user.email)


# Declarada ANTES de /testimonials/{id}: senao "reorder" cairia na rota de id.
@router.put("/testimonials/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_testimonials(
    payload: TestimonialReorderRequest,
    user: CmsUserDependency,
    service: TestimonialServiceDependency,
) -> None:
    _ = user
    if not await service.reorder(payload):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A lista de ordem nao corresponde aos depoimentos do site.",
        )


@router.put("/testimonials/{testimonial_id}", response_model=TestimonialResponse)
async def update_testimonial(
    testimonial_id: str,
    payload: TestimonialUpsert,
    user: CmsUserDependency,
    service: TestimonialServiceDependency,
) -> TestimonialResponse:
    updated = await service.update(testimonial_id, payload, user.email)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Depoimento nao encontrado."
        )
    return updated


@router.delete("/testimonials/{testimonial_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testimonial(
    testimonial_id: str,
    user: CmsUserDependency,
    service: TestimonialServiceDependency,
) -> None:
    _ = user
    if not await service.delete(testimonial_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Depoimento nao encontrado."
        )
