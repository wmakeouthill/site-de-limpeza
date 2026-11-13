from fastapi.testclient import TestClient

from app.domain.entities.site import SiteScope
from app.domain.schemas.analytics import SiteEventCreate
from app.interfaces.api.v1.dependencies.services import get_analytics_service
from app.main import create_app


class FakeAnalyticsService:
    def __init__(self) -> None:
        self.received: list[SiteEventCreate] = []
        self.received_sites: list[SiteScope] = []
        self.forgotten_attribution_ids: list[str] = []

    async def record(self, events: list[SiteEventCreate], *, site: SiteScope) -> None:
        self.received.extend(events)
        self.received_sites.append(site)

    async def forget_attribution(self, attribution_id: str) -> None:
        self.forgotten_attribution_ids.append(attribution_id)


def create_test_client(service: FakeAnalyticsService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_analytics_service] = lambda: service
    return TestClient(app)


def test_ingest_events_uses_host_to_resolve_site() -> None:
    service = FakeAnalyticsService()
    client = create_test_client(service)

    response = client.post(
        "/api/public/events",
        headers={"host": "falcaolimpeza.com.br"},
        json={
            "events": [
                {"session_id": "sessao-0001", "event": "pageview", "page": "/"},
                {"session_id": "sessao-0001", "event": "click", "target": "Quero participar"},
            ]
        },
    )

    assert response.status_code == 204
    assert service.received_sites == [SiteScope.FALCAO]
    assert [event.event for event in service.received] == ["pageview", "click"]


def test_ingest_events_rejects_unknown_event_name() -> None:
    service = FakeAnalyticsService()
    client = create_test_client(service)

    response = client.post(
        "/api/public/events",
        json={"events": [{"session_id": "sessao-0001", "event": "roubar_dados"}]},
    )

    # Schema fechado: evento fora da lista nao entra na tabela.
    assert response.status_code == 422
    assert service.received == []


def test_ingest_events_never_fails_when_service_breaks() -> None:
    class BrokenService(FakeAnalyticsService):
        async def record(self, events, *, site) -> None:
            raise RuntimeError("banco fora")

    client = create_test_client(BrokenService())

    response = client.post(
        "/api/public/events",
        json={"events": [{"session_id": "sessao-0001", "event": "pageview"}]},
    )

    # Metrica nunca quebra a pagina: erro no banco continua 204.
    assert response.status_code == 204


def test_track_script_is_served_and_skips_the_cms() -> None:
    client = create_test_client(FakeAnalyticsService())

    response = client.get("/api/public/track.js")

    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert "/api/public/events" in response.text
    assert '"/cms"' in response.text


def test_forget_tracking_never_reveals_se_o_identificador_existe() -> None:
    service = FakeAnalyticsService()
    client = create_test_client(service)

    response = client.post(
        "/api/public/tracking/forget",
        json={"attribution_id": "atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac"},
    )

    assert response.status_code == 204
    assert service.forgotten_attribution_ids == ["atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac"]
