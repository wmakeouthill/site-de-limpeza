from __future__ import annotations

from typing import TYPE_CHECKING

from app.domain.entities.site import SiteScope
from app.domain.entities.site_settings import SITE_SETTINGS_SINGLETON_ID, SiteSettings
from app.domain.repositories.site_settings_repository import SiteSettingsRepository
from app.domain.schemas.site_settings import (
    HorarioFuncionamento,
    PublicSiteSettingsResponse,
    SiteSettingsResponse,
    SiteSettingsUpdate,
)
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.config.settings import Settings

if TYPE_CHECKING:
    from app.domain.repositories.content_repository import ContentRepository
    from app.infrastructure.security.cms_session import CmsUser


class SiteSettingsService:
    """Fonte da verdade da configuracao do site e dados da loja."""

    def __init__(
        self,
        repository: SiteSettingsRepository,
        settings: Settings,
        cache_store: PublicCacheStore | None = None,
        content_repository: ContentRepository | None = None,
    ):
        self._repository = repository
        self._settings = settings
        self._cache_store = cache_store
        self._content_repository = content_repository

    async def get_settings(self) -> SiteSettingsResponse:
        entity = await self._repository.get()
        if entity is None:
            return SiteSettingsResponse(
                loja_nome="Falcão Limpeza",
                razao_social=None,
                cnpj=None,
                whatsapp_numero="5521999999999",
                telefone_exibicao="(21) 99999-9999",
                endereco="Estrada de Jacarepaguá, 5171",
                bairro_cidade="Anil, Rio de Janeiro - RJ",
                referencia_endereco="pertinho de Rio das Pedras",
                maps_url=None,
                horarios=[],
                horario_obs=None,
                pagamento="Dinheiro, Pix, cartões de débito e crédito",
                chave_pix=None,
                bairros_entrega=[],
                prazo_separacao="Separado em ~30 min",
                instagram_url=None,
                articles_enabled=True,
                guides_enabled=True,
                testimonials_enabled=self._settings.public_testimonials_enabled,
                updated_at=None,
                updated_by=None,
            )
        return self._to_response(entity)

    async def get_public_settings(
        self,
        site: SiteScope = SiteScope.FALCAO,
    ) -> PublicSiteSettingsResponse:
        _ = site
        entity = await self._repository.get()
        if entity is None:
            return PublicSiteSettingsResponse(
                testimonials_enabled=self._settings.public_testimonials_enabled,
            )
        return PublicSiteSettingsResponse(
            loja_nome=entity.loja_nome or "Falcão Limpeza",
            razao_social=entity.razao_social,
            cnpj=entity.cnpj,
            whatsapp_numero=entity.whatsapp_numero or "5521999999999",
            telefone_exibicao=entity.telefone_exibicao,
            endereco=entity.endereco or "Estrada de Jacarepaguá, 5171",
            bairro_cidade=entity.bairro_cidade or "Anil, Rio de Janeiro - RJ",
            referencia_endereco=entity.referencia_endereco,
            maps_url=entity.maps_url,
            horarios=[
                HorarioFuncionamento(**h) if isinstance(h, dict) else h
                for h in (entity.horarios or [])
            ],
            horario_obs=entity.horario_obs,
            pagamento=entity.pagamento or "Dinheiro, Pix, cartões de débito e crédito",
            chave_pix=entity.chave_pix,
            bairros_entrega=entity.bairros_entrega or [],
            prazo_separacao=entity.prazo_separacao,
            instagram_url=entity.instagram_url,
            articles_enabled=entity.articles_enabled,
            guides_enabled=entity.guides_enabled,
            testimonials_enabled=self._settings.public_testimonials_enabled,
        )

    async def is_articles_enabled(self, site: SiteScope = SiteScope.FALCAO) -> bool:
        _ = site
        entity = await self._repository.get()
        return entity.articles_enabled if entity else True

    async def is_guides_enabled(self, site: SiteScope = SiteScope.FALCAO) -> bool:
        _ = site
        entity = await self._repository.get()
        return entity.guides_enabled if entity else True

    async def update_settings(
        self,
        payload: SiteSettingsUpdate,
        user: CmsUser,
    ) -> SiteSettingsResponse:
        entity = await self._repository.get()
        if entity is None:
            entity = SiteSettings(id=SITE_SETTINGS_SINGLETON_ID)

        entity.loja_nome = payload.loja_nome
        entity.razao_social = payload.razao_social
        entity.cnpj = payload.cnpj
        entity.whatsapp_numero = payload.whatsapp_numero
        entity.telefone_exibicao = payload.telefone_exibicao
        entity.endereco = payload.endereco
        entity.bairro_cidade = payload.bairro_cidade
        entity.referencia_endereco = payload.referencia_endereco
        entity.maps_url = payload.maps_url
        entity.horarios = [h.model_dump() for h in payload.horarios]
        entity.horario_obs = payload.horario_obs
        entity.pagamento = payload.pagamento
        entity.chave_pix = payload.chave_pix
        entity.bairros_entrega = payload.bairros_entrega
        entity.prazo_separacao = payload.prazo_separacao
        entity.instagram_url = payload.instagram_url
        entity.articles_enabled = bool(payload.articles_enabled)
        entity.guides_enabled = payload.guides_enabled
        entity.updated_by = user.email

        saved = await self._repository.save(entity)
        await self._invalidate_cache()
        return self._to_response(saved)

    async def _invalidate_cache(self) -> None:
        tags = {"home", "articles", "cases", "sitemap", "robots", "products", "settings"}
        if self._cache_store:
            await self._cache_store.invalidate_tags(tags)

    def _to_response(self, entity: SiteSettings) -> SiteSettingsResponse:
        return SiteSettingsResponse(
            loja_nome=entity.loja_nome or "Falcão Limpeza",
            razao_social=entity.razao_social,
            cnpj=entity.cnpj,
            whatsapp_numero=entity.whatsapp_numero or "5521999999999",
            telefone_exibicao=entity.telefone_exibicao,
            endereco=entity.endereco or "Estrada de Jacarepaguá, 5171",
            bairro_cidade=entity.bairro_cidade or "Anil, Rio de Janeiro - RJ",
            referencia_endereco=entity.referencia_endereco,
            maps_url=entity.maps_url,
            horarios=[
                HorarioFuncionamento(**h) if isinstance(h, dict) else h
                for h in (entity.horarios or [])
            ],
            horario_obs=entity.horario_obs,
            pagamento=entity.pagamento or "Dinheiro, Pix, cartões de débito e crédito",
            chave_pix=entity.chave_pix,
            bairros_entrega=entity.bairros_entrega or [],
            prazo_separacao=entity.prazo_separacao,
            instagram_url=entity.instagram_url,
            articles_enabled=entity.articles_enabled,
            guides_enabled=entity.guides_enabled,
            testimonials_enabled=self._settings.public_testimonials_enabled,
            updated_at=entity.updated_at,
            updated_by=entity.updated_by,
        )
