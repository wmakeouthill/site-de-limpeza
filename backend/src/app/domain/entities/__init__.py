from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.domain.entities.cms_author import CmsAuthor
from app.domain.entities.cms_session import CmsSession
from app.domain.entities.content import (
    ArticleDetail,
    ArticleLike,
    CaseDetail,
    CaseMetric,
    CaseTag,
    ContentAsset,
    ContentEntry,
    ContentStatus,
    ContentType,
)
from app.domain.entities.enums import (
    CategoriaArtigo,
    Forma,
    Frequencia,
    Icone,
    PublicoGuia,
    PublicoPromocao,
    TipoAcao,
)
from app.domain.entities.guide import GuideDetail, GuideProduto
from app.domain.entities.promocao import Promocao
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import DailyAnalyticsRollup, SiteEvent, SiteEventType
from app.domain.entities.site_settings import SiteSettings
from app.domain.entities.testimonial import Testimonial

__all__ = [
    "ArticleDetail",
    "ArticleLike",
    "CampaignSourceLink",
    "CaseDetail",
    "CaseMetric",
    "CaseTag",
    "CategoriaArtigo",
    "CmsAuthor",
    "CmsSession",
    "ContentAsset",
    "ContentEntry",
    "ContentStatus",
    "ContentType",
    "DailyAnalyticsRollup",
    "Departamento",
    "Forma",
    "Frequencia",
    "GuideDetail",
    "GuideProduto",
    "Icone",
    "Kit",
    "KitItem",
    "Produto",
    "Promocao",
    "PublicoGuia",
    "PublicoPromocao",
    "SiteEvent",
    "SiteEventType",
    "SiteScope",
    "SiteSettings",
    "Testimonial",
    "TipoAcao",
]
