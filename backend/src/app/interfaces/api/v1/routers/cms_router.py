from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.application.services.cms_article_service import CmsArticleService
from app.application.services.cms_case_service import CmsCaseService
from app.application.services.cms_content_service import CmsContentService
from app.application.services.cms_guide_service import CmsGuideService
from app.domain.entities.content import ContentStatus, ContentType
from app.domain.entities.site import SiteScope
from app.domain.exceptions.content import ContentError, InvalidContentPublicationError
from app.domain.schemas.content import (
    ArticleCreate,
    ArticleUpdate,
    CaseCreate,
    CaseUpdate,
    CmsArticleResponse,
    CmsCaseResponse,
    CmsContentListResponse,
)
from app.domain.schemas.guide import (
    CmsGuideResponse,
    GuideCreate,
    GuideUpdate,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import (
    get_cms_article_service,
    get_cms_case_service,
    get_cms_content_service,
    get_cms_guide_service,
)

router = APIRouter(prefix="/api/cms", tags=["CMS"])
CmsUserDependency = Annotated[CmsUser, Depends(require_cms_user)]
CmsContentServiceDependency = Annotated[CmsContentService, Depends(get_cms_content_service)]
CmsArticleServiceDependency = Annotated[CmsArticleService, Depends(get_cms_article_service)]
CmsCaseServiceDependency = Annotated[CmsCaseService, Depends(get_cms_case_service)]
CmsGuideServiceDependency = Annotated[CmsGuideService, Depends(get_cms_guide_service)]
ContentTypeQuery = Annotated[ContentType | None, Query(alias="type")]


@router.get("/health")
async def cms_health(user: CmsUserDependency) -> dict[str, str]:
    return {"status": "ok", "user": user.email}


@router.get("/content", response_model=CmsContentListResponse)
async def list_cms_content(
    user: CmsUserDependency,
    service: CmsContentServiceDependency,
    content_type: ContentTypeQuery = None,
    status: ContentStatus | None = None,
    site: SiteScope = SiteScope.FALCAO,
) -> CmsContentListResponse:
    _ = user
    return await service.list_content(content_type=content_type, status=status, site=site)


@router.post("/articles", response_model=CmsArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    payload: ArticleCreate,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.create_article(payload, user))


@router.get("/articles/{article_id}", response_model=CmsArticleResponse)
async def get_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    _ = user
    return await _handle_content_error(service.get_article(article_id))


@router.put("/articles/{article_id}", response_model=CmsArticleResponse)
async def update_article(
    article_id: str,
    payload: ArticleUpdate,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.update_article(article_id, payload, user))


@router.post("/articles/{article_id}/publish", response_model=CmsArticleResponse)
async def publish_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.publish_article(article_id, user))


@router.post("/articles/{article_id}/unpublish", response_model=CmsArticleResponse)
async def unpublish_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.unpublish_article(article_id, user))


@router.post("/articles/{article_id}/archive", response_model=CmsArticleResponse)
async def archive_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.archive_article(article_id, user))


@router.post("/articles/{article_id}/unarchive", response_model=CmsArticleResponse)
async def unarchive_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> CmsArticleResponse:
    return await _handle_content_error(service.unarchive_article(article_id, user))


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    user: CmsUserDependency,
    service: CmsArticleServiceDependency,
) -> None:
    _ = user
    await _handle_content_error(service.delete_article(article_id))


@router.post("/cases", response_model=CmsCaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    payload: CaseCreate,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.create_case(payload, user))


@router.get("/cases/{case_id}", response_model=CmsCaseResponse)
async def get_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    _ = user
    return await _handle_content_error(service.get_case(case_id))


@router.put("/cases/{case_id}", response_model=CmsCaseResponse)
async def update_case(
    case_id: str,
    payload: CaseUpdate,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.update_case(case_id, payload, user))


@router.post("/cases/{case_id}/publish", response_model=CmsCaseResponse)
async def publish_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.publish_case(case_id, user))


@router.post("/cases/{case_id}/unpublish", response_model=CmsCaseResponse)
async def unpublish_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.unpublish_case(case_id, user))


@router.post("/cases/{case_id}/archive", response_model=CmsCaseResponse)
async def archive_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.archive_case(case_id, user))


@router.post("/cases/{case_id}/unarchive", response_model=CmsCaseResponse)
async def unarchive_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> CmsCaseResponse:
    return await _handle_content_error(service.unarchive_case(case_id, user))


@router.delete("/cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: str,
    user: CmsUserDependency,
    service: CmsCaseServiceDependency,
) -> None:
    _ = user
    await _handle_content_error(service.delete_case(case_id))


@router.post("/guides", response_model=CmsGuideResponse, status_code=status.HTTP_201_CREATED)
async def create_guide(
    payload: GuideCreate,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.create_guide(payload, user))


@router.get("/guides/{guide_id}", response_model=CmsGuideResponse)
async def get_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    _ = user
    return await _handle_content_error(service.get_guide(guide_id))


@router.put("/guides/{guide_id}", response_model=CmsGuideResponse)
async def update_guide(
    guide_id: str,
    payload: GuideUpdate,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.update_guide(guide_id, payload, user))


@router.post("/guides/{guide_id}/publish", response_model=CmsGuideResponse)
async def publish_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.publish_guide(guide_id, user))


@router.post("/guides/{guide_id}/unpublish", response_model=CmsGuideResponse)
async def unpublish_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.unpublish_guide(guide_id, user))


@router.post("/guides/{guide_id}/archive", response_model=CmsGuideResponse)
async def archive_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.archive_guide(guide_id, user))


@router.post("/guides/{guide_id}/unarchive", response_model=CmsGuideResponse)
async def unarchive_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> CmsGuideResponse:
    return await _handle_content_error(service.unarchive_guide(guide_id, user))


@router.delete("/guides/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guide(
    guide_id: str,
    user: CmsUserDependency,
    service: CmsGuideServiceDependency,
) -> None:
    _ = user
    await _handle_content_error(service.delete_guide(guide_id))


async def _handle_content_error(call):
    try:
        return await call
    except InvalidContentPublicationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except ContentError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ja existe conteudo com este slug para o mesmo tipo.",
        ) from error
