from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.config.settings import get_settings
from app.interfaces.api.v1.api_router import (
    api_router,
    media_router,
    public_api_router,
)
from app.interfaces.api.v1.routers.health_router import router as health_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    settings.cms_upload_path.mkdir(parents=True, exist_ok=True)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    settings.cms_upload_path.mkdir(parents=True, exist_ok=True)

    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
        lifespan=lifespan,
    )

    from app.interfaces.api.v1.dependencies.services import (
        get_analytics_rate_limiter,
    )
    application.state.events_rate_limiter = get_analytics_rate_limiter()

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    application.include_router(health_router)
    application.include_router(api_router, prefix=settings.api_v1_prefix)
    application.include_router(public_api_router)
    application.include_router(media_router)
    return application


app = create_app()
