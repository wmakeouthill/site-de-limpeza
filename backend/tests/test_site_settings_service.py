from types import SimpleNamespace

import pytest

from app.application.services.site_settings_service import SiteSettingsService
from app.domain.entities.site import SiteScope
from app.domain.entities.site_settings import SiteSettings
from app.domain.schemas.site_settings import HorarioFuncionamento, SiteSettingsUpdate
from app.infrastructure.cache.public_cache import PublicCacheStore


def _entity(
    *,
    loja_nome: str = "Falcão Limpeza",
    whatsapp_numero: str = "5521999999999",
    articles: bool = True,
    guides: bool = True,
    updated_by: str = "editor@falcaolimpeza.com.br",
) -> SiteSettings:
    entity = SiteSettings(
        id="site",
        loja_nome=loja_nome,
        whatsapp_numero=whatsapp_numero,
        endereco="Estrada de Jacarepaguá, 5171",
        bairro_cidade="Anil, Rio de Janeiro - RJ",
        pagamento="Dinheiro, Pix, cartões de débito e crédito",
        updated_by=updated_by,
    )
    entity.articles_enabled = articles
    entity.guides_enabled = guides
    return entity


class FakeSiteSettingsRepository:
    def __init__(self, entity: SiteSettings | None = None):
        self.entity = entity
        self.saved_entities: list[SiteSettings] = []

    async def get(self) -> SiteSettings | None:
        return self.entity

    async def save(self, entity: SiteSettings) -> SiteSettings:
        self.saved_entities.append(entity)
        self.entity = entity
        return entity


def build_settings() -> SimpleNamespace:
    return SimpleNamespace(
        cache_warmup_enabled=False,
        public_testimonials_enabled=False,
    )


def build_user() -> SimpleNamespace:
    return SimpleNamespace(email="admin@falcaolimpeza.com.br")


def _update(
    *,
    loja_nome: str = "Falcão Limpeza",
    whatsapp_numero: str = "5521988887777",
    articles: bool = True,
    guides: bool = True,
    bairros: list[str] | None = None,
) -> SiteSettingsUpdate:
    return SiteSettingsUpdate(
        loja_nome=loja_nome,
        whatsapp_numero=whatsapp_numero,
        articles_enabled=articles,
        guides_enabled=guides,
        bairros_entrega=bairros or ["Anil", "Rio das Pedras"],
        horarios=[HorarioFuncionamento(dias_semana=[1, 2, 3, 4, 5, 6], abre="08:00", fecha="19:00")],
    )


@pytest.mark.asyncio
async def test_get_settings_defaults_when_no_row() -> None:
    service = SiteSettingsService(FakeSiteSettingsRepository(), build_settings())

    response = await service.get_settings()

    assert response.loja_nome == "Falcão Limpeza"
    assert response.whatsapp_numero == "5521999999999"
    assert response.articles_enabled is True
    assert response.guides_enabled is True


@pytest.mark.asyncio
async def test_is_articles_enabled() -> None:
    entity = _entity(articles=True)
    service = SiteSettingsService(FakeSiteSettingsRepository(entity), build_settings())

    assert await service.is_articles_enabled(SiteScope.FALCAO) is True

    entity.articles_enabled = False
    assert await service.is_articles_enabled(SiteScope.FALCAO) is False


@pytest.mark.asyncio
async def test_get_public_settings_exposes_store_data() -> None:
    entity = _entity(
        loja_nome="Falcão Limpeza Anil",
        whatsapp_numero="5521977778888",
        articles=True,
        guides=True,
    )
    service = SiteSettingsService(FakeSiteSettingsRepository(entity), build_settings())

    falcao_public = await service.get_public_settings(SiteScope.FALCAO)

    assert falcao_public.loja_nome == "Falcão Limpeza Anil"
    assert falcao_public.whatsapp_numero == "5521977778888"
    assert falcao_public.articles_enabled is True
    assert falcao_public.guides_enabled is True
    assert falcao_public.testimonials_enabled is False


@pytest.mark.asyncio
async def test_update_settings_persists_data() -> None:
    repository = FakeSiteSettingsRepository()
    service = SiteSettingsService(repository, build_settings())

    payload = _update(
        loja_nome="Falcão Anil",
        whatsapp_numero="5521912345678",
        articles=True,
        guides=False,
    )
    response = await service.update_settings(payload, build_user())

    assert len(repository.saved_entities) == 1
    assert repository.saved_entities[0].loja_nome == "Falcão Anil"
    assert repository.saved_entities[0].whatsapp_numero == "5521912345678"
    assert repository.saved_entities[0].updated_by == "admin@falcaolimpeza.com.br"
    assert response.loja_nome == "Falcão Anil"
    assert response.whatsapp_numero == "5521912345678"
    assert response.guides_enabled is False


@pytest.mark.asyncio
async def test_update_settings_invalidates_cache() -> None:
    entity = _entity()
    cache = PublicCacheStore(max_entries=20)
    repository = FakeSiteSettingsRepository(entity)
    service = SiteSettingsService(repository, build_settings(), cache_store=cache)
    for key, tags in (
        ("html:/", {"home"}),
        ("html:/artigos", {"articles"}),
        ("seo:sitemap.xml", {"sitemap"}),
        ("seo:robots.txt", {"robots"}),
    ):
        await cache.set(key=key, value=key, ttl_seconds=60, stale_seconds=60, tags=tags)

    await service.update_settings(
        _update(loja_nome="Novo Nome", whatsapp_numero="5521999998888"),
        build_user(),
    )

    for key in ("html:/", "html:/artigos", "seo:sitemap.xml", "seo:robots.txt"):
        assert (await cache.get(key)).status == "MISS"
