# ruff: noqa: E402

import os

from fastapi.testclient import TestClient

from app.domain.entities.site import SiteScope
from app.domain.schemas.site_settings import (
    PublicSiteSettingsResponse,
    SiteSettingsResponse,
    SiteSettingsUpdate,
)
from app.infrastructure.config.settings import get_settings
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_site_settings_service

os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app


class FakeSiteSettingsService:
    def __init__(self) -> None:
        self.settings = SiteSettingsResponse(
            loja_nome="Falcão Limpeza",
            whatsapp_numero="5521999999999",
            telefone_exibicao="(21) 99999-9999",
            endereco="Estrada de Jacarepaguá, 5171",
            bairro_cidade="Anil, Rio de Janeiro - RJ",
            referencia_endereco="pertinho de Rio das Pedras",
            maps_url="https://maps.google.com/?q=Falcao+Limpeza",
            horarios=[],
            horario_obs=None,
            pagamento="Dinheiro, Pix, cartões de débito e crédito",
            chave_pix=None,
            bairros_entrega=["Anil", "Rio das Pedras", "Freguesia"],
            prazo_separacao="Separado em ~30 min",
            instagram_url="https://instagram.com/falcaolimpeza",
            articles_enabled=True,
            guides_enabled=True,
            testimonials_enabled=True,
        )

    async def get_settings(self) -> SiteSettingsResponse:
        return self.settings

    async def get_public_settings(
        self, site: SiteScope = SiteScope.FALCAO
    ) -> PublicSiteSettingsResponse:
        return PublicSiteSettingsResponse(
            loja_nome=self.settings.loja_nome,
            razao_social=self.settings.razao_social,
            cnpj=self.settings.cnpj,
            whatsapp_numero=self.settings.whatsapp_numero,
            telefone_exibicao=self.settings.telefone_exibicao,
            endereco=self.settings.endereco,
            bairro_cidade=self.settings.bairro_cidade,
            referencia_endereco=self.settings.referencia_endereco,
            maps_url=self.settings.maps_url,
            horarios=self.settings.horarios,
            horario_obs=self.settings.horario_obs,
            pagamento=self.settings.pagamento,
            chave_pix=self.settings.chave_pix,
            bairros_entrega=self.settings.bairros_entrega,
            prazo_separacao=self.settings.prazo_separacao,
            instagram_url=self.settings.instagram_url,
            articles_enabled=self.settings.articles_enabled,
            guides_enabled=self.settings.guides_enabled,
            testimonials_enabled=self.settings.testimonials_enabled,
        )

    async def update_settings(
        self, payload: SiteSettingsUpdate, user: CmsUser
    ) -> SiteSettingsResponse:
        self.settings = SiteSettingsResponse(
            loja_nome=payload.loja_nome,
            razao_social=payload.razao_social,
            cnpj=payload.cnpj,
            whatsapp_numero=payload.whatsapp_numero,
            telefone_exibicao=payload.telefone_exibicao,
            endereco=payload.endereco,
            bairro_cidade=payload.bairro_cidade,
            referencia_endereco=payload.referencia_endereco,
            maps_url=payload.maps_url,
            horarios=payload.horarios,
            horario_obs=payload.horario_obs,
            pagamento=payload.pagamento,
            chave_pix=payload.chave_pix,
            bairros_entrega=payload.bairros_entrega,
            prazo_separacao=payload.prazo_separacao,
            instagram_url=payload.instagram_url,
            articles_enabled=bool(payload.articles_enabled),
            guides_enabled=payload.guides_enabled,
            testimonials_enabled=True,
            updated_by=user.email,
        )
        return self.settings


def _build_client() -> tuple[TestClient, FakeSiteSettingsService]:
    app = create_app()
    service = FakeSiteSettingsService()
    fake_user = CmsUser(email="admin@falcaolimpeza.com.br", name="Admin", object_id="usr-1")

    app.dependency_overrides[get_site_settings_service] = lambda: service
    app.dependency_overrides[require_cms_user] = lambda: fake_user
    return TestClient(app), service


def test_public_site_settings_endpoint() -> None:
    client, _ = _build_client()
    response = client.get("/api/public/site-settings")
    assert response.status_code == 200
    data = response.json()
    assert data["loja_nome"] == "Falcão Limpeza"
    assert data["whatsapp_numero"] == "5521999999999"
    assert data["bairro_cidade"] == "Anil, Rio de Janeiro - RJ"
    assert "bairros_entrega" in data
    assert "horarios" in data


def test_cms_get_site_settings() -> None:
    client, _ = _build_client()
    response = client.get("/api/cms/site-settings")
    assert response.status_code == 200
    data = response.json()
    assert data["loja_nome"] == "Falcão Limpeza"
    assert data["whatsapp_numero"] == "5521999999999"


def test_cms_update_site_settings_and_public_reflection() -> None:
    client, _ = _build_client()

    payload = {
        "loja_nome": "Falcão Anil Matriz",
        "whatsapp_numero": "5521987654321",
        "endereco": "Estrada de Jacarepaguá, 5171",
        "bairro_cidade": "Anil, Rio de Janeiro - RJ",
        "maps_url": "https://maps.app.goo.gl/xyz123",
        "pagamento": "Dinheiro, Pix, Cartão",
        "bairros_entrega": ["Anil", "Rio das Pedras", "Gardênia Azul"],
        "articles_enabled": True,
        "guides_enabled": True,
        "horarios": [
            {"dias_semana": [1, 2, 3, 4, 5, 6], "abre": "08:00", "fecha": "19:00"}
        ],
    }

    put_res = client.put("/api/cms/site-settings", json=payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["loja_nome"] == "Falcão Anil Matriz"
    assert updated["whatsapp_numero"] == "5521987654321"

    # CA-12: reflete no endpoint público
    pub_res = client.get("/api/public/site-settings")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["loja_nome"] == "Falcão Anil Matriz"
    assert pub_data["whatsapp_numero"] == "5521987654321"
    assert "Gardênia Azul" in pub_data["bairros_entrega"]


def test_cms_update_validation_errors() -> None:
    client, _ = _build_client()

    # Erro: maps_url sem https://
    invalid_url = {
        "loja_nome": "Falcão Limpeza",
        "whatsapp_numero": "5521987654321",
        "maps_url": "http://inseguro.com",
    }
    res = client.put("/api/cms/site-settings", json=invalid_url)
    assert res.status_code == 422

    # Erro: whatsapp sem DDI 55
    invalid_wa = {
        "loja_nome": "Falcão Limpeza",
        "whatsapp_numero": "21987654321",
    }
    res2 = client.put("/api/cms/site-settings", json=invalid_wa)
    assert res2.status_code == 422
