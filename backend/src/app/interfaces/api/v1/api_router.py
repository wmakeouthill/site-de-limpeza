from fastapi import APIRouter

from app.interfaces.api.v1.routers.analytics_router import router as analytics_router
from app.interfaces.api.v1.routers.cms_analytics_router import (
    router as cms_analytics_router,
)
from app.interfaces.api.v1.routers.cms_auth_router import router as cms_auth_router
from app.interfaces.api.v1.routers.cms_authors_router import router as cms_authors_router
from app.interfaces.api.v1.routers.cms_campaign_links_router import (
    router as cms_campaign_links_router,
)
from app.interfaces.api.v1.routers.cms_catalog_router import (
    router as cms_catalog_router,
)
from app.interfaces.api.v1.routers.cms_promocao_router import (
    router as cms_promocao_router,
)
from app.interfaces.api.v1.routers.cms_router import router as cms_router
from app.interfaces.api.v1.routers.cms_settings_router import router as cms_settings_router
from app.interfaces.api.v1.routers.cms_testimonials_router import (
    router as cms_testimonials_router,
)
from app.interfaces.api.v1.routers.cms_uploads_router import router as cms_uploads_router
from app.interfaces.api.v1.routers.health_router import router as health_router
from app.interfaces.api.v1.routers.media_router import router as media_router
from app.interfaces.api.v1.routers.public_catalog_router import (
    router as public_catalog_router,
)
from app.interfaces.api.v1.routers.public_content_router import (
    router as public_content_router,
)
from app.interfaces.api.v1.routers.public_promocao_router import (
    router as public_promocao_router,
)

api_router = APIRouter()
api_router.include_router(health_router)

public_api_router = APIRouter()
public_api_router.include_router(public_content_router)
public_api_router.include_router(public_catalog_router)
public_api_router.include_router(public_promocao_router)
public_api_router.include_router(analytics_router)
public_api_router.include_router(cms_auth_router)
public_api_router.include_router(cms_router)
public_api_router.include_router(cms_authors_router)
public_api_router.include_router(cms_settings_router)
public_api_router.include_router(cms_testimonials_router)
public_api_router.include_router(cms_analytics_router)
public_api_router.include_router(cms_campaign_links_router)
public_api_router.include_router(cms_uploads_router)
public_api_router.include_router(cms_catalog_router)
public_api_router.include_router(cms_promocao_router)

__all__ = [
    "api_router",
    "media_router",
    "public_api_router",
]
