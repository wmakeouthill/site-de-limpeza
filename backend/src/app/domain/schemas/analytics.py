import re
import unicodedata
from datetime import date, datetime
from typing import Self
from urllib.parse import urlparse, urlsplit

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domain.entities.site_event import SiteEventType
from app.domain.schemas.campaign_source_link import CampaignSourceLinkResponse

ALLOWED_WHATSAPP_TARGETS: frozenset[str] = frozenset(
    {"lista", "cotacao", "bairro", "produto", "flutuante"}
)

_ATTRIBUTION_VALUE = re.compile(r"[^a-z0-9._-]+")


def _normalize_attribution_value(value: object, *, max_length: int = 80) -> str:
    normalized = unicodedata.normalize("NFD", str(value or "").strip().lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return _ATTRIBUTION_VALUE.sub("-", normalized).strip("-")[:max_length]


def _normalize_referrer_host(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    host = urlparse(raw).hostname if "://" in raw else raw.split("/")[0]
    return _normalize_attribution_value(host.removeprefix("www.") if host else "", max_length=120)


def _normalize_page(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    parsed = urlsplit(raw)
    path = parsed.path if parsed.path else raw.split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/"):
        path = "/" + path.lstrip("/")
    path = path[:255]
    if path.startswith("/cms"):
        raise ValueError("Eventos de /cms não são coletados.")
    return path


class AttributionTouch(BaseModel):
    """Origem minimizada de uma visita, vinculÃ¡vel somente no prazo de retenÃ§Ã£o."""

    source: str = Field(..., min_length=1, max_length=80)
    medium: str = Field(..., min_length=1, max_length=80)
    campaign: str = Field(default="", max_length=80)
    term: str = Field(default="", max_length=80)
    content: str = Field(default="", max_length=80)
    placement: str = Field(default="", max_length=80)
    referrer_host: str = Field(default="", max_length=120)
    landing_page: str = Field(default="/", min_length=1, max_length=255)
    captured_at: datetime
    expires_at: datetime

    @field_validator("source", "medium", "campaign", "term", "content", "placement", mode="before")
    @classmethod
    def normalize_dimensions(cls, value: object) -> str:
        return _normalize_attribution_value(value)

    @field_validator("referrer_host", mode="before")
    @classmethod
    def normalize_referrer_host(cls, value: object) -> str:
        return _normalize_referrer_host(value)

    @field_validator("landing_page", mode="before")
    @classmethod
    def normalize_landing_page(cls, value: object) -> str:
        return _normalize_page(value)


class SiteEventCreate(BaseModel):
    """Um evento vindo do track.js. Tudo opcional menos sessao e tipo."""

    session_id: str = Field(..., min_length=8, max_length=36)
    attribution_id: str = Field(
        default="", min_length=0, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]{7,63}$|^$"
    )
    event: SiteEventType
    # Horario em que a interacao ocorreu no navegador. O lote pode chegar
    # segundos depois, mas a timeline precisa manter a ordem real da jornada.
    occurred_at: datetime | None = None
    target: str = Field(default="", max_length=200)
    page: str = Field(default="", max_length=255)
    referrer: str = Field(default="", max_length=120)
    utm_source: str = Field(default="", max_length=80)
    utm_medium: str = Field(default="", max_length=80)
    utm_campaign: str = Field(default="", max_length=80)
    utm_term: str = Field(default="", max_length=80)
    utm_content: str = Field(default="", max_length=80)
    placement: str = Field(default="", max_length=80)
    first_touch: AttributionTouch | None = None
    last_touch: AttributionTouch | None = None
    device: str = Field(default="", max_length=20)
    # Teto de 6h: alem disso e aba esquecida aberta, nao leitura.
    dwell_ms: int = Field(default=0, ge=0, le=21_600_000)
    pos_x: int = Field(default=0, ge=0, le=100)
    pos_y: int = Field(default=0, ge=0, le=100)

    @field_validator(
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "placement",
        mode="before",
    )
    @classmethod
    def normalize_dimensions(cls, value: object) -> str:
        return _normalize_attribution_value(value)

    @field_validator("referrer", mode="before")
    @classmethod
    def normalize_referrer(cls, value: object) -> str:
        return _normalize_referrer_host(value)

    @field_validator("page", mode="before")
    @classmethod
    def normalize_page(cls, value: object) -> str:
        return _normalize_page(value)

    @model_validator(mode="after")
    def validate_event_target(self) -> Self:
        if self.event == SiteEventType.WHATSAPP_CLICK:
            if self.target not in ALLOWED_WHATSAPP_TARGETS:
                raise ValueError(
                    f"Target inválido para whatsapp_click: {self.target!r}. "
                    f"Valores permitidos: {sorted(ALLOWED_WHATSAPP_TARGETS)}"
                )
        elif self.event == SiteEventType.BUSCA:
            self.target = _normalize_attribution_value(self.target, max_length=50)
        elif self.event == SiteEventType.LISTA_ADD:
            self.target = _normalize_attribution_value(self.target, max_length=80)
        elif self.event in (
            SiteEventType.POPUP_VIEW,
            SiteEventType.POPUP_CLICK,
            SiteEventType.POPUP_CLOSE,
        ):
            self.target = _normalize_attribution_value(self.target, max_length=80)
        return self


class SiteEventBatch(BaseModel):
    """O track.js acumula e manda em lote (1 request por descarga)."""

    events: list[SiteEventCreate] = Field(..., min_length=1, max_length=50)


class TrackingForgetRequest(BaseModel):
    attribution_id: str = Field(
        ...,
        min_length=8,
        max_length=64,
        pattern=r"^[a-z0-9][a-z0-9-]{7,63}$",
    )


class AnalyticsOverview(BaseModel):
    """Os numeros grandes do topo do dashboard."""

    visitors: int = 0
    pageviews: int = 0
    clicks: int = 0
    form_submits: int = 0
    # Mediana, nao media: uma aba esquecida aberta distorce a media.
    median_dwell_ms: int = 0
    bounce_rate: float = 0.0


class AnalyticsSiteCount(BaseModel):
    site: str
    count: int = 0


class AnalyticsRawLabel(BaseModel):
    """Valor original que compoe uma linha normalizada do ranking."""

    label: str
    count: int = 0


class AnalyticsPointSite(BaseModel):
    site: str
    visitors: int = 0
    pageviews: int = 0


class AnalyticsPoint(BaseModel):
    day: date
    visitors: int = 0
    pageviews: int = 0
    by_site: list[AnalyticsPointSite] = Field(default_factory=list)


class AnalyticsPeriod(BaseModel):
    start: date
    end: date


class WeeklyRhythmPoint(BaseModel):
    weekday: int
    label: str
    visitors: int = 0


class AnalyticsCreative(BaseModel):
    """Criativo/variante observado dentro de uma campanha."""

    label: str
    count: int = 0
    placement: str = ""
    link: CampaignSourceLinkResponse | None = None


class AnalyticsCampaign(BaseModel):
    """Campanha observada dentro de uma origem de trafego."""

    label: str
    count: int = 0
    creatives: list[AnalyticsCreative] = Field(default_factory=list)


class AnalyticsChannel(BaseModel):
    site: str
    overview: AnalyticsOverview


class FunnelStep(BaseModel):
    step: str
    label: str
    sessions: int = 0
    by_site: list[AnalyticsSiteCount] = Field(default_factory=list)
    # % sobre o primeiro passo do funil (0-100).
    rate: float = 0.0


class AnalyticsRow(BaseModel):
    """Linha de qualquer um dos rankings (paginas, CTAs, origens, devices)."""

    label: str
    count: int = 0
    # Composição observada do item: nunca uma repartição proporcional estimada.
    by_site: list[AnalyticsSiteCount] = Field(default_factory=list)
    # So em origens e dispositivos: valores brutos disponiveis no tooltip.
    raw_labels: list[AnalyticsRawLabel] = Field(default_factory=list)
    # So em origens: campanha, criativo e ficha de link por sessao.
    campaigns: list[AnalyticsCampaign] = Field(default_factory=list)
    # Só nos CTAs: media de onde o clique cai dentro do botao, em %.
    pos_x: int | None = None
    pos_y: int | None = None


class AnalyticsPageItem(BaseModel):
    """Uma rota observada, sempre identificada pelo canal real."""

    site: str
    path: str
    pageviews: int = 0


class AnalyticsPageList(BaseModel):
    items: list[AnalyticsPageItem] = Field(default_factory=list)
    total: int = 0
    page: int
    page_size: int


class AnalyticsDashboard(BaseModel):
    overview: AnalyticsOverview
    period: AnalyticsPeriod
    comparison_overview: AnalyticsOverview
    timeseries: list[AnalyticsPoint] = Field(default_factory=list)
    comparison_timeseries: list[AnalyticsPoint] = Field(default_factory=list)
    weekly_rhythm: list[WeeklyRhythmPoint] = Field(default_factory=list)
    pages_per_session: float = 0.0
    channels: list[AnalyticsChannel] = Field(default_factory=list)
    funnel: list[FunnelStep] = Field(default_factory=list)
    top_pages: list[AnalyticsRow] = Field(default_factory=list)
    top_ctas: list[AnalyticsRow] = Field(default_factory=list)
    sources: list[AnalyticsRow] = Field(default_factory=list)
    devices: list[AnalyticsRow] = Field(default_factory=list)
    whatsapp_clicks: list[AnalyticsRow] = Field(default_factory=list)
    top_lista_products: list[AnalyticsRow] = Field(default_factory=list)
    top_search_terms: list[AnalyticsRow] = Field(default_factory=list)
    promotions_summary: list[AnalyticsRow] = Field(default_factory=list)
