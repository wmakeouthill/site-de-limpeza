import re
from datetime import UTC, date, datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import JSON, Date, DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.entities.site import SiteScope
from app.infrastructure.database.base import Base


def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


_CAMPAIGN_IDENTIFIER = re.compile(r"[a-z0-9][a-z0-9._-]{0,79}\Z")


def campaign_identifier(utm_content: str) -> str:
    """Mantém apenas o identificador seguro e estável do link de campanha."""
    return utm_content if _CAMPAIGN_IDENTIFIER.fullmatch(utm_content) else ""


def lead_submission_target(contact_id: str, utm_content: str) -> str:
    """Marcador terminal que liga uma jornada anônima ao contato salvo.

    A coluna `target` já existe e fica indexada pela janela de data; guardar o
    identificador aqui evita uma migration só para metadados de analytics.
    """
    content = campaign_identifier(utm_content)
    return f"lead:{contact_id}|content:{content}"


def lead_submission_prefix(contact_id: str) -> str:
    return f"lead:{contact_id}|content:"


def lead_submission_content(target: str, contact_id: str) -> str:
    prefix = lead_submission_prefix(contact_id)
    return target[len(prefix) :] if target.startswith(prefix) else ""


class SiteEventType(StrEnum):
    """Eventos que o track.js emite. Passo do funil na ordem desta lista.

    Fechado de proposito: o schema rejeita nome fora daqui, senao qualquer
    script na pagina consegue poluir a tabela. Evento novo = uma linha aqui.
    """

    PAGEVIEW = "pageview"
    CASE_VIEW = "case_view"
    SCROLL = "scroll"
    CLICK = "click"
    FORM_OPEN = "form_open"
    FORM_SUBMIT = "form_submit"
    # Emitido no unload com o tempo real de aba visivel na pagina.
    ENGAGEMENT = "engagement"
    # Eventos de analytics da Falcão Limpeza (CA-23)
    WHATSAPP_CLICK = "whatsapp_click"
    LISTA_ADD = "lista_add"
    BUSCA = "busca"
    POPUP_VIEW = "popup_view"
    POPUP_CLICK = "popup_click"
    POPUP_CLOSE = "popup_close"


class SiteEvent(Base):
    """Um evento de uso do site publico (visita, clique, permanencia).

    Tabela local (Postgres), sem espelho no aura: e volume alto e serve so ao
    dashboard do CMS — o mesmo caminho de `article_likes`.
    """

    __tablename__ = "site_events"
    __table_args__ = (
        # O dashboard sempre filtra por site + janela de data.
        Index("ix_site_events_site_created_at", "site", "created_at"),
        # O funil e o tempo de permanencia agrupam por sessao.
        Index("ix_site_events_session_id", "session_id"),
        # A jornada filtra sessao, site e janela de recebimento.
        Index("ix_site_events_session_site_created_at", "session_id", "site", "created_at"),
        Index("ix_site_events_attribution_id", "attribution_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    site: Mapped[SiteScope] = mapped_column(String(20), nullable=False, default=SiteScope.FALCAO)
    # Anonimo e de 1a parte: gerado no browser, sem cookie de terceiro.
    session_id: Mapped[str] = mapped_column(String(36), nullable=False)
    # Identificador pseudonimo por site; serve somente para retencao/oposicao.
    attribution_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    event: Mapped[SiteEventType] = mapped_column(String(40), nullable=False)
    # Clique: rotulo do data-track (ou seletor). Scroll: o marco (25/50/75/100).
    target: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    page: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    # Apenas host do referenciador, nunca URL/query completa.
    referrer: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    utm_source: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    utm_medium: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    utm_campaign: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    utm_term: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    utm_content: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    placement: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    # Os dois snapshots so aparecem no marcador de envio do lead.
    first_touch: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)
    last_touch: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)
    device: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    # Só no engagement: ms de aba visivel (nao o relogio de parede).
    dwell_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Só no click: onde dentro do elemento, em % — e o dado do mapa de calor.
    pos_x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pos_y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Horario do browser, saneado no service. Serve apenas para ordem visual.
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Horario confiavel de recebimento: retencao, associacao e agregados.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class DailyAnalyticsRollup(Base):
    """Snapshot diario sem identificadores para historico do dashboard."""

    __tablename__ = "daily_analytics_rollups"

    # Espelha a migration 0017 (PK composta day+site); os testes usam create_all
    # e nao pegam divergencia com o banco migrado.
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    site: Mapped[SiteScope] = mapped_column(String(32), primary_key=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
