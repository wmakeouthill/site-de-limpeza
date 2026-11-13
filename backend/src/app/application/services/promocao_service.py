from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.domain.entities.promocao import Promocao
from app.domain.repositories.promocao_repository import PromocaoRepository
from app.domain.schemas.promocao import (
    CmsPromocaoRead,
    PromocaoCreate,
    PromocaoUpdate,
    PublicPromocaoRead,
)

TZ_SP = ZoneInfo("America/Sao_Paulo")


def agora_sp() -> datetime:
    return datetime.now(TZ_SP)


def calcular_situacao(promo: Promocao, agora: datetime) -> str:
    if not promo.is_active:
        return "desligada"

    inicio = promo.data_inicio
    fim = promo.data_fim

    if agora.tzinfo is not None:
        if inicio.tzinfo is None:
            inicio = inicio.replace(tzinfo=agora.tzinfo)
        if fim.tzinfo is None:
            fim = fim.replace(tzinfo=agora.tzinfo)
    elif inicio.tzinfo is not None:
        agora = agora.replace(tzinfo=inicio.tzinfo)

    if agora < inicio:
        return "agendada"
    if agora > fim:
        return "encerrada"
    return "no_ar"


class PromocaoService:
    def __init__(self, repository: PromocaoRepository) -> None:
        self.repository = repository

    async def get_active_promotions(
        self, publico: str | None = None
    ) -> list[PublicPromocaoRead]:
        agora = agora_sp()
        promos = await self.repository.list_active(publico=publico, agora=agora)
        return [PublicPromocaoRead.model_validate(p) for p in promos]

    async def list_cms_promotions(self) -> list[CmsPromocaoRead]:
        agora = agora_sp()
        promos = await self.repository.list_all()

        result: list[CmsPromocaoRead] = []
        for p in promos:
            situacao = calcular_situacao(p, agora)
            taxa_clique = 0.0
            if p.views_count > 0:
                taxa_clique = round((p.clicks_count / p.views_count) * 100, 1)

            dto = CmsPromocaoRead(
                id=p.id,
                titulo=p.titulo,
                texto=p.texto,
                imagem_url=p.imagem_url,
                tipo_acao=p.tipo_acao,  # type: ignore
                produto_id=p.produto_id,
                cta_texto=p.cta_texto,
                cta_caminho=p.cta_caminho,
                codigo_cupom=p.codigo_cupom,
                whatsapp_mensagem=p.whatsapp_mensagem,
                publico=p.publico,  # type: ignore
                frequencia=p.frequencia,  # type: ignore
                data_inicio=p.data_inicio,
                data_fim=p.data_fim,
                prioridade=p.prioridade,
                is_active=p.is_active,
                situacao=situacao,
                views_count=p.views_count,
                clicks_count=p.clicks_count,
                taxa_clique_pct=taxa_clique,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            result.append(dto)
        return result

    async def create_promotion(
        self, payload: PromocaoCreate, user_email: str = ""
    ) -> CmsPromocaoRead:
        promo = Promocao(
            titulo=payload.titulo,
            texto=payload.texto or "",
            imagem_url=payload.imagem_url,
            tipo_acao=payload.tipo_acao.value,
            produto_id=payload.produto_id,
            cta_texto=payload.cta_texto or "",
            cta_caminho=payload.cta_caminho or "",
            codigo_cupom=payload.codigo_cupom or "",
            whatsapp_mensagem=payload.whatsapp_mensagem or "",
            publico=payload.publico.value,
            frequencia=payload.frequencia.value,
            data_inicio=payload.data_inicio,
            data_fim=payload.data_fim,
            prioridade=payload.prioridade,
            is_active=payload.is_active,
            created_by=user_email,
            updated_by=user_email,
        )
        created = await self.repository.create(promo)
        await self.repository.session.commit()

        agora = agora_sp()
        return CmsPromocaoRead(
            id=created.id,
            titulo=created.titulo,
            texto=created.texto,
            imagem_url=created.imagem_url,
            tipo_acao=created.tipo_acao,  # type: ignore
            produto_id=created.produto_id,
            cta_texto=created.cta_texto,
            cta_caminho=created.cta_caminho,
            codigo_cupom=created.codigo_cupom,
            whatsapp_mensagem=created.whatsapp_mensagem,
            publico=created.publico,  # type: ignore
            frequencia=created.frequencia,  # type: ignore
            data_inicio=created.data_inicio,
            data_fim=created.data_fim,
            prioridade=created.prioridade,
            is_active=created.is_active,
            situacao=calcular_situacao(created, agora),
            views_count=created.views_count,
            clicks_count=created.clicks_count,
            taxa_clique_pct=0.0,
            created_at=created.created_at,
            updated_at=created.updated_at,
        )

    async def update_promotion(
        self, promo_id: str, payload: PromocaoUpdate, user_email: str = ""
    ) -> CmsPromocaoRead:
        promo = await self.repository.get_by_id(promo_id)
        if not promo:
            raise HTTPException(status_code=404, detail="Promoção não encontrada")

        if payload.titulo is not None:
            promo.titulo = payload.titulo
        if payload.texto is not None:
            promo.texto = payload.texto
        if payload.imagem_url is not None:
            promo.imagem_url = payload.imagem_url
        if payload.tipo_acao is not None:
            promo.tipo_acao = payload.tipo_acao.value
        if payload.produto_id is not None:
            promo.produto_id = payload.produto_id
        if payload.cta_texto is not None:
            promo.cta_texto = payload.cta_texto
        if payload.cta_caminho is not None:
            promo.cta_caminho = payload.cta_caminho
        if payload.codigo_cupom is not None:
            promo.codigo_cupom = payload.codigo_cupom
        if payload.whatsapp_mensagem is not None:
            promo.whatsapp_mensagem = payload.whatsapp_mensagem
        if payload.publico is not None:
            promo.publico = payload.publico.value
        if payload.frequencia is not None:
            promo.frequencia = payload.frequencia.value
        if payload.data_inicio is not None:
            promo.data_inicio = payload.data_inicio
        if payload.data_fim is not None:
            promo.data_fim = payload.data_fim
        if payload.prioridade is not None:
            promo.prioridade = payload.prioridade
        if payload.is_active is not None:
            promo.is_active = payload.is_active

        promo.updated_by = user_email
        await self.repository.session.commit()

        agora = agora_sp()
        taxa = 0.0
        if promo.views_count > 0:
            taxa = round((promo.clicks_count / promo.views_count) * 100, 1)

        return CmsPromocaoRead(
            id=promo.id,
            titulo=promo.titulo,
            texto=promo.texto,
            imagem_url=promo.imagem_url,
            tipo_acao=promo.tipo_acao,  # type: ignore
            produto_id=promo.produto_id,
            cta_texto=promo.cta_texto,
            cta_caminho=promo.cta_caminho,
            codigo_cupom=promo.codigo_cupom,
            whatsapp_mensagem=promo.whatsapp_mensagem,
            publico=promo.publico,  # type: ignore
            frequencia=promo.frequencia,  # type: ignore
            data_inicio=promo.data_inicio,
            data_fim=promo.data_fim,
            prioridade=promo.prioridade,
            is_active=promo.is_active,
            situacao=calcular_situacao(promo, agora),
            views_count=promo.views_count,
            clicks_count=promo.clicks_count,
            taxa_clique_pct=taxa,
            created_at=promo.created_at,
            updated_at=promo.updated_at,
        )

    async def delete_promotion(self, promo_id: str) -> None:
        promo = await self.repository.get_by_id(promo_id)
        if not promo:
            raise HTTPException(status_code=404, detail="Promoção não encontrada")
        await self.repository.delete(promo)
        await self.repository.session.commit()
