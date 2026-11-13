from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analytics_service import AnalyticsService
from app.application.services.article_like_service import ArticleLikeService
from app.application.services.campaign_source_link_service import (
    CampaignSourceLinkService,
)
from app.application.services.catalog_service import CatalogService
from app.application.services.cms_article_service import CmsArticleService
from app.application.services.cms_author_service import CmsAuthorService
from app.application.services.cms_case_service import CmsCaseService
from app.application.services.cms_content_service import CmsContentService
from app.application.services.cms_guide_service import CmsGuideService
from app.application.services.promocao_service import PromocaoService
from app.application.services.public_content_service import PublicContentService
from app.application.services.site_settings_service import SiteSettingsService
from app.application.services.testimonial_service import TestimonialService
from app.domain.entities.site import SiteScope
from app.domain.repositories.article_like_repository import ArticleLikeRepository
from app.domain.repositories.cms_author_repository import CmsAuthorRepository
from app.domain.repositories.content_repository import ContentRepository
from app.domain.repositories.promocao_repository import PromocaoRepository
from app.domain.repositories.site_settings_repository import SiteSettingsRepository
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.database.session import get_db_session
from app.infrastructure.indexnow import IndexNowClient
from app.infrastructure.repositories.article_like_repository import (
    SqlAlchemyArticleLikeRepository,
)
from app.infrastructure.repositories.campaign_source_link_repository import (
    SqlAlchemyCampaignSourceLinkRepository,
)
from app.infrastructure.repositories.catalog_repository import SqlAlchemyCatalogRepository
from app.infrastructure.repositories.cms_author_repository import (
    SqlAlchemyCmsAuthorRepository,
)
from app.infrastructure.repositories.cms_session_repository import (
    SqlAlchemyCmsSessionRepository,
)
from app.infrastructure.repositories.content_repository import SqlAlchemyContentRepository
from app.infrastructure.repositories.site_event_repository import (
    SqlAlchemySiteEventRepository,
)
from app.infrastructure.repositories.site_settings_repository import (
    SqlAlchemySiteSettingsRepository,
)
from app.infrastructure.repositories.testimonial_repository import (
    SqlAlchemyTestimonialRepository,
)
from app.infrastructure.security.rate_limiter import SlidingWindowRateLimiter

SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
SettingsDependency = Annotated[Settings, Depends(get_settings)]


@lru_cache
def get_public_cache_store() -> PublicCacheStore:
    return PublicCacheStore(max_entries=256)


def get_content_repository(
    session: SessionDependency,
) -> ContentRepository:
    return SqlAlchemyContentRepository(session)


def get_cms_session_repository(
    session: SessionDependency,
) -> SqlAlchemyCmsSessionRepository:
    return SqlAlchemyCmsSessionRepository(session)


def get_cms_content_service(
    repository: Annotated[ContentRepository, Depends(get_content_repository)],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
) -> CmsContentService:
    return CmsContentService(repository, cache_store)


def get_cms_author_repository(
    session: SessionDependency,
) -> CmsAuthorRepository:
    return SqlAlchemyCmsAuthorRepository(session)


def get_cms_author_service(
    repository: Annotated[CmsAuthorRepository, Depends(get_cms_author_repository)],
) -> CmsAuthorService:
    return CmsAuthorService(repository)


def get_indexnow_client(settings: SettingsDependency) -> IndexNowClient:
    return IndexNowClient(settings.indexnow_key, settings.public_site_base_url_clean)


def get_cms_article_service(
    repository: Annotated[ContentRepository, Depends(get_content_repository)],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
    indexnow: Annotated[IndexNowClient, Depends(get_indexnow_client)],
) -> CmsArticleService:
    return CmsArticleService(repository, cache_store, indexnow)


def get_cms_case_service(
    repository: Annotated[ContentRepository, Depends(get_content_repository)],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
    indexnow: Annotated[IndexNowClient, Depends(get_indexnow_client)],
) -> CmsCaseService:
    return CmsCaseService(repository, cache_store, indexnow)


def get_cms_guide_service(
    repository: Annotated[ContentRepository, Depends(get_content_repository)],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
    indexnow: Annotated[IndexNowClient, Depends(get_indexnow_client)],
) -> CmsGuideService:
    return CmsGuideService(repository, cache_store, indexnow)


def get_public_content_service(
    repository: Annotated[ContentRepository, Depends(get_content_repository)],
    testimonial_repository: Annotated[
        SqlAlchemyTestimonialRepository,
        Depends(lambda session=Depends(get_db_session): SqlAlchemyTestimonialRepository(session)),
    ],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
    settings: SettingsDependency,
) -> PublicContentService:
    return PublicContentService(
        content_repository=repository,
        cache_store=cache_store,
        data_ttl_seconds=settings.public_data_cache_ttl_seconds,
        data_stale_seconds=settings.public_data_cache_stale_seconds,
        site=SiteScope.FALCAO,
        testimonial_repository=testimonial_repository,
    )


def get_testimonial_repository(
    session: SessionDependency,
) -> SqlAlchemyTestimonialRepository:
    return SqlAlchemyTestimonialRepository(session)


def get_testimonial_service(
    repository: Annotated[
        SqlAlchemyTestimonialRepository, Depends(get_testimonial_repository)
    ],
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
) -> TestimonialService:
    return TestimonialService(
        repository=repository,
        cache_store=cache_store,
    )


def get_site_settings_repository(
    session: SessionDependency,
) -> SiteSettingsRepository:
    return SqlAlchemySiteSettingsRepository(session)


def get_site_settings_service(
    repository: Annotated[SiteSettingsRepository, Depends(get_site_settings_repository)],
    settings: SettingsDependency,
    cache_store: Annotated[PublicCacheStore, Depends(get_public_cache_store)],
    content_repository: Annotated[ContentRepository, Depends(get_content_repository)],
) -> SiteSettingsService:
    return SiteSettingsService(
        repository=repository,
        settings=settings,
        cache_store=cache_store,
        content_repository=content_repository,
    )


def get_article_like_repository(
    session: SessionDependency,
) -> ArticleLikeRepository:
    return SqlAlchemyArticleLikeRepository(session)


def get_article_like_service(
    like_repository: Annotated[
        ArticleLikeRepository, Depends(get_article_like_repository)
    ],
    content_repository: Annotated[ContentRepository, Depends(get_content_repository)],
) -> ArticleLikeService:
    return ArticleLikeService(content_repository, like_repository)


def get_site_event_repository(
    session: SessionDependency,
) -> SqlAlchemySiteEventRepository:
    return SqlAlchemySiteEventRepository(session)


def get_campaign_source_link_repository(
    session: SessionDependency,
) -> SqlAlchemyCampaignSourceLinkRepository:
    return SqlAlchemyCampaignSourceLinkRepository(session)


def get_campaign_source_link_service(
    repository: Annotated[
        SqlAlchemyCampaignSourceLinkRepository,
        Depends(get_campaign_source_link_repository),
    ],
) -> CampaignSourceLinkService:
    return CampaignSourceLinkService(repository)


def get_analytics_service(
    repository: Annotated[
        SqlAlchemySiteEventRepository, Depends(get_site_event_repository)
    ],
    campaign_links: Annotated[
        SqlAlchemyCampaignSourceLinkRepository,
        Depends(get_campaign_source_link_repository),
    ],
) -> AnalyticsService:
    return AnalyticsService(repository, campaign_links)


def resolve_request_site(
    request: Request | None = None,
    settings: Settings | None = None,
) -> SiteScope:
    return SiteScope.FALCAO


@lru_cache
def get_cms_login_rate_limiter() -> SlidingWindowRateLimiter:
    return SlidingWindowRateLimiter(max_requests=10, window_seconds=15 * 60)


@lru_cache
def get_analytics_rate_limiter() -> SlidingWindowRateLimiter:
    return SlidingWindowRateLimiter(max_requests=60, window_seconds=60)


def get_catalog_repository(
    session: SessionDependency,
) -> SqlAlchemyCatalogRepository:
    return SqlAlchemyCatalogRepository(session)


def get_catalog_service(
    repository: Annotated[
        SqlAlchemyCatalogRepository, Depends(get_catalog_repository)
    ],
) -> CatalogService:
    return CatalogService(repository)


def get_promocao_repository(
    session: SessionDependency,
) -> PromocaoRepository:
    return PromocaoRepository(session)


def get_promocao_service(
    repository: Annotated[
        PromocaoRepository, Depends(get_promocao_repository)
    ],
) -> PromocaoService:
    return PromocaoService(repository)
