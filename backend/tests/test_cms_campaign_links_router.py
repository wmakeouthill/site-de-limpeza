# ruff: noqa: E402

import os

from fastapi.testclient import TestClient

from app.domain.schemas.campaign_source_link import CampaignSourceLinkResponse
from app.infrastructure.config.settings import get_settings
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_campaign_source_link_service

# A rota não usa cache de página. Evita que a configuração local de produção
# aponte o DiskCache de teste para um caminho inexistente no Windows.
os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app


class FakeCampaignSourceLinkService:
    def __init__(self) -> None:
        self.saved: CampaignSourceLinkResponse | None = None

    async def list_all(self) -> list[CampaignSourceLinkResponse]:
        return [self.saved] if self.saved else []

    async def upsert(
        self,
        identifier: str,
        *,
        title: str,
        source_url: str,
        thumbnail_url: str,
        redirect_url: str,
    ) -> CampaignSourceLinkResponse:
        self.saved = CampaignSourceLinkResponse(
            identifier=identifier,
            title=title,
            source_url=source_url,
            thumbnail_url=thumbnail_url,
            redirect_url=redirect_url,
        )
        return self.saved

    async def delete(self, identifier: str) -> bool:
        if self.saved is None or self.saved.identifier != identifier:
            return False
        self.saved = None
        return True


def _client(service: FakeCampaignSourceLinkService) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="editor@example.com", name="Editor", object_id="user-id"
    )
    app.dependency_overrides[get_campaign_source_link_service] = lambda: service
    return TestClient(app)


def test_cms_cadastra_lista_e_remove_link_de_campanha() -> None:
    service = FakeCampaignSourceLinkService()
    client = _client(service)

    saved = client.put(
        "/api/cms/campaign-links/reel-agosto-01",
        json={
            "title": "Reel: agentes de IA",
            "source_url": "https://www.instagram.com/reel/ABC123/",
            "thumbnail_url": "https://cdn.example.com/reel-agosto-01.jpg",
        },
    )

    assert saved.status_code == 200
    assert saved.json()["identifier"] == "reel-agosto-01"
    assert client.get("/api/cms/campaign-links").json()[0]["title"] == "Reel: agentes de IA"
    assert client.delete("/api/cms/campaign-links/reel-agosto-01").status_code == 204


def test_cms_rejeita_link_de_campanha_com_url_nao_https() -> None:
    response = _client(FakeCampaignSourceLinkService()).put(
        "/api/cms/campaign-links/reel-agosto-01",
        json={
            "title": "Reel: agentes de IA",
            "source_url": "http://www.instagram.com/reel/ABC123/",
            "thumbnail_url": "",
        },
    )

    assert response.status_code == 422


def test_cms_rejeita_identificador_de_campanha_invalido() -> None:
    response = _client(FakeCampaignSourceLinkService()).put(
        "/api/cms/campaign-links/reel-agosto!",
        json={
            "title": "Reel: agentes de IA",
            "source_url": "https://www.instagram.com/reel/ABC123/",
            "thumbnail_url": "",
        },
    )

    assert response.status_code == 422
