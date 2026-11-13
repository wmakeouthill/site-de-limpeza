# ruff: noqa: E402

import os
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.infrastructure.config.settings import get_settings

os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()

from app.domain.schemas.analytics import (
    AnalyticsDashboard,
    AnalyticsOverview,
    AnalyticsPageItem,
    AnalyticsPageList,
    AnalyticsPeriod,
)
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_analytics_service
from app.main import create_app


class FakeAnalyticsService:
    def __init__(self) -> None:
        self.start_at: datetime | None = None
        self.end_at: datetime | None = None

    async def dashboard(self, **filters: object) -> AnalyticsDashboard:
        self.start_at = _date_filter(filters, "start_at")
        self.end_at = _date_filter(filters, "end_at")
        return AnalyticsDashboard(
            overview=AnalyticsOverview(),
            comparison_overview=AnalyticsOverview(),
            period=AnalyticsPeriod(
                start=datetime(2026, 8, 1, tzinfo=UTC).date(),
                end=datetime(2026, 8, 1, tzinfo=UTC).date(),
            ),
        )

    async def pages(self, **filters: object) -> AnalyticsPageList:
        self.start_at = _date_filter(filters, "start_at")
        self.end_at = _date_filter(filters, "end_at")
        return AnalyticsPageList(
            items=[
                AnalyticsPageItem(
                    site="falcao",
                    path="/cases/guia-defesa-flagrante",
                    pageviews=1,
                )
            ],
            total=1,
            page=1,
            page_size=20,
        )


def _date_filter(filters: dict[str, object], key: str) -> datetime | None:
    value = filters.get(key)
    return value if isinstance(value, datetime) else None


def _client(service: FakeAnalyticsService) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="editor@example.com", name="Editor", object_id="user-id"
    )
    app.dependency_overrides[get_analytics_service] = lambda: service
    return TestClient(app)


def test_cms_analytics_router_accepts_explicit_date_range() -> None:
    service = FakeAnalyticsService()

    response = _client(service).get("/api/cms/analytics?from=2026-08-01&to=2026-08-19")

    assert response.status_code == 200
    assert service.start_at is not None
    assert service.end_at is not None
    assert service.start_at < service.end_at


def test_cms_analytics_router_rejects_period_above_retention() -> None:
    response = _client(FakeAnalyticsService()).get(
        "/api/cms/analytics?from=2025-08-01&to=2026-08-01"
    )

    assert response.status_code == 422


def test_cms_analytics_router_lista_paginas_paginadas_por_canal() -> None:
    service = FakeAnalyticsService()

    response = _client(service).get(
        "/api/cms/analytics/pages?site=falcao&from=2026-08-01&to=2026-08-19"
    )

    assert response.status_code == 200
    assert response.json()["items"] == [
        {
            "site": "falcao",
            "path": "/cases/guia-defesa-flagrante",
            "pageviews": 1,
        }
    ]
    assert service.start_at is not None
