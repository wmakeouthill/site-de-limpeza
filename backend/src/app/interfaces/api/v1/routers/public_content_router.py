import hashlib
import hmac
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.application.services.article_like_service import ArticleLikeService
from app.application.services.public_content_service import PublicContentService
from app.application.services.site_settings_service import SiteSettingsService
from app.domain.schemas.content import (
    ArticleLikeStateResponse,
    PublicArticleCardResponse,
    PublicArticleDetailResponse,
    PublicCaseCardResponse,
    PublicCaseDetailResponse,
)
from app.domain.schemas.guide import (
    PublicGuideCardResponse,
    PublicGuideDetailResponse,
)
from app.domain.schemas.site_settings import PublicSiteSettingsResponse
from app.domain.schemas.testimonial import PublicTestimonialResponse
from app.infrastructure.cache.public_cache import create_etag
from app.infrastructure.config.settings import get_settings
from app.interfaces.api.v1.dependencies.services import (
    get_article_like_service,
    get_public_content_service,
    get_site_settings_service,
    resolve_request_site,
)

router = APIRouter(prefix="/api/public", tags=["Public Content"])
ARTICLE_NOT_FOUND_DETAIL = "Artigo publicado nao encontrado."
PublicContentServiceDependency = Annotated[
    PublicContentService,
    Depends(get_public_content_service),
]
ArticleLikeServiceDependency = Annotated[
    ArticleLikeService,
    Depends(get_article_like_service),
]
SiteSettingsServiceDependency = Annotated[
    SiteSettingsService,
    Depends(get_site_settings_service),
]


@router.get("/site-settings", response_model=PublicSiteSettingsResponse)
async def get_public_site_settings(
    request: Request,
    response: Response,
    service: SiteSettingsServiceDependency,
) -> PublicSiteSettingsResponse | Response:
    # Expoe APENAS articles_enabled (nunca e-mails de contato), do site do Host.
    site = resolve_request_site(request, get_settings())
    settings = await service.get_public_settings(site)
    etag = create_etag(settings.model_dump_json())
    # Feature flag de runtime: o browser deve sempre revalidar para refletir o
    # toggle do CMS na hora. O ETag mantem a eficiencia (304 quando nao mudou).
    response.headers["Cache-Control"] = "no-cache"
    response.headers["ETag"] = etag
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=dict(response.headers))
    return settings


@router.get("/articles", response_model=list[PublicArticleCardResponse])
async def list_published_articles(
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
    categoria: str | None = None,
) -> list[PublicArticleCardResponse] | Response:
    if not await _articles_enabled(request, site_settings_service):
        # Toggle off: lista vazia sem cache para reaparecer na hora ao religar.
        response.headers["Cache-Control"] = "no-cache"
        return []
    articles = await service.list_articles(categoria=categoria)
    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or articles


@router.get("/articles/{slug}", response_model=PublicArticleDetailResponse)
async def get_published_article(
    slug: str,
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
) -> PublicArticleDetailResponse | Response:
    if not await _articles_enabled(request, site_settings_service):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ARTICLE_NOT_FOUND_DETAIL,
        )
    article = await service.get_article_by_slug(slug)
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ARTICLE_NOT_FOUND_DETAIL,
        )

    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or article


@router.get("/articles/{slug}/likes", response_model=ArticleLikeStateResponse)
async def get_article_like_state(
    slug: str, request: Request, response: Response, service: ArticleLikeServiceDependency
) -> ArticleLikeStateResponse:
    visitor_hash = _article_visitor_hash(request, response)
    result = await service.get_state(
        slug, visitor_hash, resolve_request_site(request, get_settings())
    )
    if result is None:
        raise HTTPException(status_code=404, detail=ARTICLE_NOT_FOUND_DETAIL)
    liked, likes_count = result
    return ArticleLikeStateResponse(liked=liked, likes_count=likes_count)


@router.post("/articles/{slug}/likes/toggle", response_model=ArticleLikeStateResponse)
async def toggle_article_like(
    slug: str, request: Request, response: Response, service: ArticleLikeServiceDependency
) -> ArticleLikeStateResponse:
    visitor_hash = _article_visitor_hash(request, response)
    result = await service.toggle(slug, visitor_hash, resolve_request_site(request, get_settings()))
    if result is None:
        raise HTTPException(status_code=404, detail=ARTICLE_NOT_FOUND_DETAIL)
    liked, likes_count = result
    return ArticleLikeStateResponse(liked=liked, likes_count=likes_count)


async def _articles_enabled(request: Request, service: SiteSettingsService) -> bool:
    return await service.is_articles_enabled(resolve_request_site(request, get_settings()))


async def _guides_enabled(request: Request, service: SiteSettingsService) -> bool:
    return await service.is_guides_enabled(resolve_request_site(request, get_settings()))


def _article_visitor_hash(request: Request, response: Response) -> str:
    settings = get_settings()
    raw_visitor = request.cookies.get("talimpo_article_visitor", "")
    try:
        visitor_id = str(UUID(raw_visitor))
    except (ValueError, AttributeError):
        visitor_id = str(uuid4())
        response.set_cookie(
            "talimpo_article_visitor",
            visitor_id,
            max_age=31_536_000,
            httponly=True,
            secure=settings.environment.lower() in {"prod", "production"},
            samesite="lax",
        )
    secret = settings.cms_session_secret or "dev-only-article-like-secret"
    return hmac.new(secret.encode("utf-8"), visitor_id.encode("utf-8"), hashlib.sha256).hexdigest()


@router.get("/cases", response_model=list[PublicCaseCardResponse])
async def list_published_cases(
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
) -> list[PublicCaseCardResponse] | Response:
    if not await _guides_enabled(request, site_settings_service):
        response.headers["Cache-Control"] = "no-cache"
        return []
    cases = await service.list_cases()
    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or cases


@router.get("/cases/{slug}", response_model=PublicCaseDetailResponse)
async def get_published_case(
    slug: str,
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
) -> PublicCaseDetailResponse | Response:
    if not await _guides_enabled(request, site_settings_service):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guia publicado nao encontrado.",
        )
    case_entry = await service.get_case_by_slug(slug)
    if not case_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guia publicado nao encontrado.",
        )

    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or case_entry


@router.get("/guides", response_model=list[PublicGuideCardResponse])
async def list_published_guides(
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
    publico: str | None = None,
) -> list[PublicGuideCardResponse] | Response:
    if not await _guides_enabled(request, site_settings_service):
        response.headers["Cache-Control"] = "no-cache"
        return []
    guides = await service.list_guides(publico=publico)
    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or guides


@router.get("/guides/{slug}", response_model=PublicGuideDetailResponse)
async def get_published_guide(
    slug: str,
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
    site_settings_service: SiteSettingsServiceDependency,
) -> PublicGuideDetailResponse | Response:
    if not await _guides_enabled(request, site_settings_service):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guia publicado nao encontrado.",
        )
    guide_entry = await service.get_guide_by_slug(slug)
    if not guide_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guia publicado nao encontrado.",
        )

    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or guide_entry


@router.get("/testimonials", response_model=list[PublicTestimonialResponse])
async def list_published_testimonials(
    request: Request,
    response: Response,
    service: PublicContentServiceDependency,
) -> list[PublicTestimonialResponse] | Response:
    testimonials = await service.list_testimonials()
    cached_response = _set_public_cache_headers(request, response, service)
    return cached_response or testimonials



def _set_public_cache_headers(
    request: Request,
    response: Response,
    service: PublicContentService,
) -> Response | None:
    etag = getattr(service, "last_cache_etag", "")
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=3600"
    response.headers["X-Cache"] = getattr(service, "last_cache_status", "BYPASS")
    if not etag:
        return None

    response.headers["ETag"] = etag
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=dict(response.headers))

    return None
