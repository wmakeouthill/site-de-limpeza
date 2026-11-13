import pytest
from fastapi.testclient import TestClient

from app.domain.entities.site import SiteScope
from app.domain.schemas.analytics import SiteEventCreate
from app.interfaces.api.v1.dependencies.services import get_analytics_service
from app.main import create_app


class FakeAnalyticsService:
    def __init__(self) -> None:
        self.received: list[SiteEventCreate] = []
        self.received_sites: list[SiteScope] = []

    async def record(self, events: list[SiteEventCreate], *, site: SiteScope) -> None:
        self.received.extend(events)
        self.received_sites.append(site)


@pytest.fixture
def fake_service() -> FakeAnalyticsService:
    return FakeAnalyticsService()


@pytest.fixture
def client(fake_service: FakeAnalyticsService) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_analytics_service] = lambda: fake_service
    return TestClient(app)


def test_whatsapp_click_with_valid_targets_records_event(
    client: TestClient, fake_service: FakeAnalyticsService
) -> None:
    # CA-23: whatsapp_click com target = 'lista', 'cotacao', 'bairro', 'produto', 'flutuante'
    valid_targets = ["lista", "cotacao", "bairro", "produto", "flutuante"]
    for target in valid_targets:
        response = client.post(
            "/api/public/events",
            json={
                "events": [
                    {
                        "session_id": "sessao-valid-001",
                        "event": "whatsapp_click",
                        "target": target,
                        "page": "/",
                    }
                ]
            },
        )
        assert response.status_code == 204

    assert len(fake_service.received) == len(valid_targets)
    assert [e.target for e in fake_service.received] == valid_targets


def test_whatsapp_click_with_invalid_target_rejects_with_422(
    client: TestClient, fake_service: FakeAnalyticsService
) -> None:
    # CA-23: se o target estiver fora dos formatos permitidos ou carregar dados da mensagem, 422
    invalid_targets = [
        "Olá, gostaria de fazer um pedido de água sanitária",
        "21999998888",
        "carrinho",
        "lista_modal",
        "",
        "unknown_button",
    ]

    for target in invalid_targets:
        response = client.post(
            "/api/public/events",
            json={
                "events": [
                    {
                        "session_id": "sessao-invalid-001",
                        "event": "whatsapp_click",
                        "target": target,
                        "page": "/produtos",
                    }
                ]
            },
        )
        assert response.status_code == 422

    assert len(fake_service.received) == 0


def test_busca_event_normalizes_and_truncates_target(
    client: TestClient, fake_service: FakeAnalyticsService
) -> None:
    response = client.post(
        "/api/public/events",
        json={
            "events": [
                {
                    "session_id": "sessao-busca-001",
                    "event": "busca",
                    "target": "ÁGUA Sanitária 2 Litros Super Concentrada Perfumada Extra",
                    "page": "/produtos",
                }
            ]
        },
    )
    assert response.status_code == 204
    assert len(fake_service.received) == 1
    event = fake_service.received[0]
    assert event.event == "busca"
    assert len(event.target) <= 50
    assert "agua-sanitaria" in event.target


def test_lista_add_and_popup_events(
    client: TestClient, fake_service: FakeAnalyticsService
) -> None:
    response = client.post(
        "/api/public/events",
        json={
            "events": [
                {
                    "session_id": "sessao-flow-001",
                    "event": "lista_add",
                    "target": "prod-detergente-5l",
                    "page": "/produtos/detergente-5l",
                },
                {
                    "session_id": "sessao-flow-001",
                    "event": "popup_view",
                    "target": "promo-boas-vindas",
                    "page": "/",
                },
                {
                    "session_id": "sessao-flow-001",
                    "event": "popup_click",
                    "target": "promo-boas-vindas",
                    "page": "/",
                },
                {
                    "session_id": "sessao-flow-001",
                    "event": "popup_close",
                    "target": "promo-boas-vindas",
                    "page": "/",
                },
            ]
        },
    )
    assert response.status_code == 204
    assert len(fake_service.received) == 4
    assert [e.event for e in fake_service.received] == [
        "lista_add",
        "popup_view",
        "popup_click",
        "popup_close",
    ]
