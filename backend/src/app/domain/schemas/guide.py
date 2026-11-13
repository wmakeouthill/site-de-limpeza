from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.enums import PublicoGuia
from app.domain.entities.site import SiteScope
from app.domain.schemas.content import ContentEntryBase, ContentEntryResponse


class GuideProdutoInput(BaseModel):
    produto_id: str = Field(..., min_length=1)
    quantidade: int = Field(default=1, ge=1, le=99)
    ordem: int = Field(default=0, ge=0)


class GuideDetailInput(BaseModel):
    publico: PublicoGuia = Field(default=PublicoGuia.AMBOS)
    tempo_minutos: int = Field(default=15, ge=1, le=600)
    etiqueta: str = Field(default="", max_length=24)
    icone: str = Field(default="sparkle", max_length=50)
    dificuldade: str = Field(default="Fácil", max_length=30)


class GuideCreate(ContentEntryBase):
    site: SiteScope = SiteScope.FALCAO
    guide_detail: GuideDetailInput = Field(default_factory=GuideDetailInput)
    produtos: list[GuideProdutoInput] = Field(default_factory=list)
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""


class GuideUpdate(ContentEntryBase):
    guide_detail: GuideDetailInput = Field(default_factory=GuideDetailInput)
    produtos: list[GuideProdutoInput] = Field(default_factory=list)
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""


class GuideProdutoResponse(BaseModel):
    id: str
    produto_id: str
    nome: str
    slug: str
    quantidade: int
    ordem: int
    preco_atual: str
    preco_de: str
    preco_por: str | None = None
    is_active: bool = True
    imagem_url: str | None = None
    forma: str | None = None
    cor: str | None = None
    tamanho: str | None = None

    model_config = ConfigDict(from_attributes=True)


class CmsGuideResponse(ContentEntryResponse):
    site: SiteScope
    publico: PublicoGuia
    tempo_minutos: int
    etiqueta: str
    icone: str
    dificuldade: str
    produtos: list[GuideProdutoResponse] = Field(default_factory=list)


class PublicGuideCardResponse(BaseModel):
    id: str
    title: str
    slug: str
    publico: str
    tempo_minutos: int
    tempo_display: str
    etiqueta: str
    icone: str
    dificuldade: str
    excerpt: str
    cover_url: str | None = None
    first_published_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicGuideDetailResponse(PublicGuideCardResponse):
    body_markdown: str
    seo_title: str
    seo_description: str
    author: str
    published_at: datetime | None = None
    updated_at: datetime | None = None
    produtos: list[GuideProdutoResponse] = Field(default_factory=list)
