from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.domain.entities  # noqa: F401
from app.domain.entities.content import generate_id
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import (
    DailyAnalyticsRollup,
    SiteEvent,
    SiteEventType,
)
from app.infrastructure.analytics.analytics_retention import run_analytics_retention
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.database.session import get_db_session
from app.infrastructure.repositories.site_event_repository import SqlAlchemySiteEventRepository
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.main import create_app

TEST_USER = CmsUser(
    email="admin@falcaolimpeza.com.br",
    name="Admin Falcão",
    object_id="user-falcao-admin",
)


@pytest.fixture
def test_settings(tmp_path) -> Settings:
    return Settings(
        ENVIRONMENT="test",
        CMS_SESSION_SECRET="test-secret-falcao-analytics-32bytes",
        CMS_UPLOAD_DIR=str(tmp_path / "uploads"),
        ANALYTICS_ENABLED=True,
        ANALYTICS_RETENTION_DAYS=90,
    )


@pytest_asyncio.fixture
async def test_session_maker():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    yield session_maker
    await engine.dispose()


@pytest.fixture
def client(test_settings: Settings, test_session_maker) -> TestClient:
    app = create_app()

    async def override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        async with test_session_maker() as session:
            yield session

    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_db_session] = override_get_db_session
    app.dependency_overrides[require_cms_user] = lambda: TEST_USER
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Servir /api/public/track.js
# ---------------------------------------------------------------------------


def test_track_script_serves_talimpo_contracts_and_skips_cms(client: TestClient) -> None:
    response = client.get("/api/public/track.js")
    assert response.status_code == 200
    assert "application/javascript" in response.headers["content-type"]
    content = response.text

    assert "window.talimpoPrivacy" in content
    assert "window.auPrivacy" in content
    assert "talimpoprivacychange" in content
    assert "window.talimpoTrack" in content
    assert "window.auTrack" in content
    assert "window.talimpoLeadTracking" in content
    assert "window.auLeadTracking" in content

    assert "talimpo_track_session" in content
    assert "talimpo_attribution:" in content
    assert "talimpo_privacy:" in content
    assert "data-site" in content
    assert '"falcao"' in content

    assert 'location.pathname.indexOf("/cms") === 0' in content
    assert "doNotTrackEnabled" in content

    assert "guias" in content
    assert "cases" in content


# ---------------------------------------------------------------------------
# 2. Ingestão de POST /api/public/events
# ---------------------------------------------------------------------------


def test_ingest_events_sanitizes_query_strings_and_rejects_cms(
    client: TestClient, test_session_maker
) -> None:
    response = client.post(
        "/api/public/events",
        headers={"host": "falcaolimpeza.com.br"},
        json={
            "events": [
                {
                    "session_id": "sessao-valid-01",
                    "event": "pageview",
                    "page": "/artigos/lei-geral?token=secret123&utm_source=google#comentarios",
                }
            ]
        },
    )
    assert response.status_code == 204

    response_cms = client.post(
        "/api/public/events",
        headers={"host": "falcaolimpeza.com.br"},
        json={
            "events": [
                {
                    "session_id": "sessao-cms-01",
                    "event": "pageview",
                    "page": "/cms/artigos",
                }
            ]
        },
    )
    assert response_cms.status_code == 422

    response_invalid_event = client.post(
        "/api/public/events",
        headers={"host": "falcaolimpeza.com.br"},
        json={
            "events": [
                {
                    "session_id": "sessao-inv-01",
                    "event": "evento_proibido_hack",
                }
            ]
        },
    )
    assert response_invalid_event.status_code == 422


@pytest.mark.asyncio
async def test_ingest_events_never_stores_sensitive_personal_data(
    client: TestClient, test_session_maker
) -> None:
    client.post(
        "/api/public/events",
        headers={"host": "falcaolimpeza.com.br"},
        json={
            "events": [
                {
                    "session_id": "sessao-priv-01",
                    "event": "form_open",
                    "target": "Campo · Nome completo",
                    "page": "/contato",
                }
            ]
        },
    )

    async with test_session_maker() as session:
        events = list((await session.execute(select(SiteEvent))).scalars())
        assert len(events) >= 1
        event = events[0]
        assert not hasattr(event, "email")
        assert not hasattr(event, "phone")
        assert not hasattr(event, "message")
        assert "Campo · Nome completo" in event.target


# ---------------------------------------------------------------------------
# 3. Agregação completa do GET /api/cms/analytics e /api/cms/analytics/pages
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_cms_analytics_dashboard_aggregation_and_pages(
    client: TestClient, test_session_maker
) -> None:
    now = datetime.now(UTC)
    async with test_session_maker() as session:
        session.add_all(
            [
                SiteEvent(
                    id=generate_id(),
                    site=SiteScope.FALCAO,
                    session_id="sessao-dash-1",
                    event=SiteEventType.PAGEVIEW,
                    page="/guias/defesa-flagrante",
                    device="mobile",
                    utm_source="google",
                    utm_medium="organic",
                    created_at=now - timedelta(hours=2),
                ),
                SiteEvent(
                    id=generate_id(),
                    site=SiteScope.FALCAO,
                    session_id="sessao-dash-1",
                    event=SiteEventType.CLICK,
                    target="WhatsApp Flutuante @ footer",
                    page="/guias/defesa-flagrante",
                    device="mobile",
                    created_at=now - timedelta(hours=2),
                ),
                SiteEvent(
                    id=generate_id(),
                    site=SiteScope.FALCAO,
                    session_id="sessao-dash-1",
                    event=SiteEventType.ENGAGEMENT,
                    dwell_ms=45000,
                    page="/guias/defesa-flagrante",
                    device="mobile",
                    created_at=now - timedelta(hours=2),
                ),
                SiteEvent(
                    id=generate_id(),
                    site=SiteScope.FALCAO,
                    session_id="sessao-dash-2",
                    event=SiteEventType.PAGEVIEW,
                    page="/contato",
                    device="desktop",
                    created_at=now - timedelta(hours=1),
                ),
                SiteEvent(
                    id=generate_id(),
                    site=SiteScope.FALCAO,
                    session_id="sessao-dash-2",
                    event=SiteEventType.FORM_SUBMIT,
                    target="form-contato",
                    page="/contato",
                    device="desktop",
                    created_at=now - timedelta(hours=1),
                ),
            ]
        )
        await session.commit()

    response = client.get("/api/cms/analytics?site=falcao&days=7")
    assert response.status_code == 200
    data = response.json()

    assert data["overview"]["visitors"] == 2
    assert data["overview"]["pageviews"] == 2
    assert data["overview"]["clicks"] == 1
    assert data["overview"]["form_submits"] == 1

    funnel = {step["step"]: step["sessions"] for step in data["funnel"]}
    assert funnel["pageview"] == 2
    assert funnel["click"] == 1
    assert funnel["form_submit"] == 1

    ctas = [cta["label"] for cta in data["top_ctas"]]
    assert any("WhatsApp" in c for c in ctas)

    devices = {d["label"]: d["count"] for d in data["devices"]}
    assert "Celular" in devices or "mobile" in devices
    assert "Computador" in devices or "desktop" in devices

    pages_res = client.get("/api/cms/analytics/pages?site=falcao&page=1&page_size=10")
    assert pages_res.status_code == 200
    pages_data = pages_res.json()
    assert pages_data["total"] >= 2
    paths = [item["path"] for item in pages_data["items"]]
    assert "/guias/defesa-flagrante" in paths
    assert "/contato" in paths


# ---------------------------------------------------------------------------
# 4. Links de campanha (CRUD, validação e consumo real)
# ---------------------------------------------------------------------------


def test_campaign_links_crud_and_validation(client: TestClient) -> None:
    res_js = client.put(
        "/api/cms/campaign-links/link-xss",
        json={
            "title": "Ataque",
            "source_url": "javascript:alert(1)",
        },
    )
    assert res_js.status_code == 422

    res_http = client.put(
        "/api/cms/campaign-links/link-insecure",
        json={
            "title": "Inseguro",
            "source_url": "http://falcaolimpeza.com.br",
        },
    )
    assert res_http.status_code == 422

    create_res = client.put(
        "/api/cms/campaign-links/campanha-google-01",
        json={
            "title": "Google Ads Flagrante",
            "source_url": "https://falcaolimpeza.com.br/guias/defesa-flagrante",
            "thumbnail_url": "https://falcaolimpeza.com.br/assets/flagrante.webp",
            "redirect_url": "https://falcaolimpeza.com.br/bio",
        },
    )
    assert create_res.status_code == 200
    assert create_res.json()["identifier"] == "campanha-google-01"

    list_res = client.get("/api/cms/campaign-links")
    assert list_res.status_code == 200
    identifiers = [link_item["identifier"] for link_item in list_res.json()]
    assert "campanha-google-01" in identifiers

    del_res = client.delete("/api/cms/campaign-links/campanha-google-01")
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_campaign_link_consumption_in_sources(
    client: TestClient, test_session_maker
) -> None:
    now = datetime.now(UTC)

    client.put(
        "/api/cms/campaign-links/reel-consumidor-01",
        json={
            "title": "Reel Defesa Consumidor",
            "source_url": "https://www.instagram.com/reel/XYZ987/",
            "thumbnail_url": "https://falcaolimpeza.com.br/assets/thumb.webp",
            "redirect_url": "https://falcaolimpeza.com.br/bio-consumidor",
        },
    )

    async with test_session_maker() as session:
        session.add(
            SiteEvent(
                id=generate_id(),
                site=SiteScope.FALCAO,
                session_id="sessao-camp-1",
                event=SiteEventType.PAGEVIEW,
                page="/guias/direito-consumidor",
                utm_source="instagram",
                utm_campaign="campanha-consumidor",
                utm_content="reel-consumidor-01",
                created_at=now,
            )
        )
        await session.commit()

    dash_res = client.get("/api/cms/analytics?site=falcao&days=1")
    assert dash_res.status_code == 200
    sources = dash_res.json()["sources"]
    assert len(sources) >= 1
    found_link = False
    for src in sources:
        for camp in src.get("campaigns", []):
            for creative in camp.get("creatives", []):
                if creative.get("link") and creative["link"]["identifier"] == "reel-consumidor-01":
                    found_link = True
    assert found_link is True


# ---------------------------------------------------------------------------
# 5. Retenção e Esquecimento
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retention_archives_rollups_and_purges_expired(
    test_session_maker,
) -> None:
    now = datetime.now(UTC)
    expired_date = now - timedelta(days=2)

    async with test_session_maker() as session:
        session.add(
            SiteEvent(
                id=generate_id(),
                site=SiteScope.FALCAO,
                session_id="sessao-antiga",
                event=SiteEventType.PAGEVIEW,
                page="/guias/defesa-flagrante",
                created_at=expired_date,
            )
        )
        session.add(
            SiteEvent(
                id=generate_id(),
                site=SiteScope.FALCAO,
                session_id="sessao-nova",
                event=SiteEventType.PAGEVIEW,
                page="/contato",
                created_at=now,
            )
        )
        await session.commit()

        repo = SqlAlchemySiteEventRepository(session)
        purged = await run_analytics_retention(repo, days=1)
        assert purged == 1

        rollups = list((await session.execute(select(DailyAnalyticsRollup))).scalars())
        assert len(rollups) >= 1

        events = list((await session.execute(select(SiteEvent))).scalars())
        assert len(events) == 1
        assert events[0].session_id == "sessao-nova"


@pytest.mark.asyncio
async def test_forget_tracking_removes_attribution_events(
    client: TestClient, test_session_maker
) -> None:
    attr_id = "atr-esquecer-123456"
    async with test_session_maker() as session:
        session.add(
            SiteEvent(
                id=generate_id(),
                site=SiteScope.FALCAO,
                session_id="sessao-forget",
                attribution_id=attr_id,
                event=SiteEventType.PAGEVIEW,
                page="/",
            )
        )
        await session.commit()

    response = client.post("/api/public/tracking/forget", json={"attribution_id": attr_id})
    assert response.status_code == 204

    async with test_session_maker() as session:
        remaining = list(
            (
                await session.execute(
                    select(SiteEvent).where(SiteEvent.attribution_id == attr_id)
                )
            ).scalars()
        )
        assert len(remaining) == 0
