import math
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator

TZ_SP = ZoneInfo("America/Sao_Paulo")


def slugify(text: str) -> str:
    """Gera um slug amigável a partir de uma string."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    clean = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return clean or "item"


def hoje_sao_paulo() -> date:
    """Retorna a data atual no fuso horário oficial da loja (America/Sao_Paulo)."""
    return datetime.now(TZ_SP).date()


def calcular_oferta(
    preco_de: Decimal,
    preco_por: Decimal | None,
    promo_inicio: date | None,
    promo_fim: date | None,
    hoje: date | None = None,
) -> tuple[bool, int | None, Decimal]:
    """Calcula se uma promoção está ativa no fuso horário de São Paulo.

    Retorna: (promo_ativa: bool, desconto_pct: int | None, preco_atual: Decimal)
    """
    if hoje is None:
        hoje = hoje_sao_paulo()

    if (
        preco_por is not None
        and preco_por < preco_de
        and promo_fim is not None
        and (promo_inicio is None or hoje >= promo_inicio)
        and hoje <= promo_fim
    ):
        diff = preco_de - preco_por
        pct = math.floor((diff / preco_de) * Decimal(100))
        return True, int(pct), preco_por

    return False, None, preco_de


# ==============================================================================
# DEPARTAMENTOS
# ==============================================================================


class DepartamentoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str = Field(..., min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    descricao: str | None = Field(default="")
    icone: str = Field(default="drop", max_length=20)
    uso: str | None = Field(default="", max_length=255)
    cuidado: str | None = Field(default="", max_length=255)
    ordem: int = Field(default=0)
    is_active: bool = Field(default=True)

    @model_validator(mode="after")
    def populate_slug(self) -> "DepartamentoCreate":
        if not self.slug:
            self.slug = slugify(self.nome)
        return self


class DepartamentoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    descricao: str | None = None
    icone: str | None = Field(default=None, max_length=20)
    uso: str | None = Field(default=None, max_length=255)
    cuidado: str | None = Field(default=None, max_length=255)
    ordem: int | None = None
    is_active: bool | None = None


class PublicDepartamentoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    slug: str
    descricao: str | None = ""
    icone: str = "drop"
    uso: str | None = ""
    cuidado: str | None = ""
    ordem: int = 0


class CmsDepartamentoResponse(PublicDepartamentoResponse):
    is_active: bool = True
    total_produtos: int = 0
    created_at: datetime
    updated_at: datetime


# ==============================================================================
# PRODUTOS
# ==============================================================================


def _validar_regras_oferta(
    preco_de: Decimal,
    preco_por: Decimal | None,
    promo_inicio: date | None,
    promo_fim: date | None,
) -> None:
    if preco_por is not None:
        if preco_por >= preco_de:
            raise ValueError("Preço promocional deve ser menor que o preço original.")
        if promo_fim is None:
            raise ValueError("Data de término da oferta é obrigatória.")
        if promo_inicio is not None and promo_inicio > promo_fim:
            raise ValueError("Data de início da oferta não pode ser posterior à data de término.")


# Vira transform-origin no site (style inline): só "center" ou "x% y%", nada que injete CSS.
IMAGEM_POSICAO_PATTERN = r"^(center|\d{1,3}(\.\d{1,2})?% \d{1,3}(\.\d{1,2})?%)$"


class ProdutoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    departamento_id: str
    nome: str = Field(..., min_length=2, max_length=160)
    slug: str | None = Field(default=None, max_length=160)
    marca: str = Field(default="", max_length=80)
    tamanho: str = Field(default="", max_length=40)
    descricao: str = Field(default="")
    como_usar: str = Field(default="")
    forma: str = Field(default="garrafa", max_length=20)
    cor: str = Field(default="#003399", max_length=7)
    imagem_url: str | None = Field(default=None, max_length=1000)
    imagem_posicao: str = Field(default="center", max_length=20, pattern=IMAGEM_POSICAO_PATTERN)
    imagem_zoom: int = Field(default=100, ge=50, le=300)
    preco_de: Decimal = Field(..., gt=Decimal(0))
    preco_por: Decimal | None = Field(default=None, gt=Decimal(0))
    promo_inicio: date | None = None
    promo_fim: date | None = None
    embalagem_grande: bool = Field(default=False)
    ordem: int = Field(default=0)
    is_active: bool = Field(default=True)

    @model_validator(mode="after")
    def validate_and_slugify(self) -> "ProdutoCreate":
        if not self.slug:
            self.slug = slugify(f"{self.nome} {self.tamanho}".strip())
        _validar_regras_oferta(self.preco_de, self.preco_por, self.promo_inicio, self.promo_fim)
        return self


class ProdutoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    departamento_id: str | None = None
    nome: str | None = Field(default=None, min_length=2, max_length=160)
    slug: str | None = Field(default=None, max_length=160)
    marca: str | None = Field(default=None, max_length=80)
    tamanho: str | None = Field(default=None, max_length=40)
    descricao: str | None = None
    como_usar: str | None = None
    forma: str | None = Field(default=None, max_length=20)
    cor: str | None = Field(default=None, max_length=7)
    imagem_url: str | None = Field(default=None, max_length=1000)
    imagem_posicao: str | None = Field(default=None, max_length=20, pattern=IMAGEM_POSICAO_PATTERN)
    imagem_zoom: int | None = Field(default=None, ge=50, le=300)
    preco_de: Decimal | None = Field(default=None, gt=Decimal(0))
    preco_por: Decimal | None = None
    promo_inicio: date | None = None
    promo_fim: date | None = None
    embalagem_grande: bool | None = None
    ordem: int | None = None
    is_active: bool | None = None


class PublicProdutoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    departamento_id: str
    departamento_nome: str | None = None
    departamento_slug: str | None = None
    nome: str
    slug: str
    marca: str
    tamanho: str
    descricao: str
    como_usar: str
    forma: str
    cor: str
    imagem_url: str | None
    imagem_posicao: str
    imagem_zoom: int
    preco_de: str
    preco_por: str | None = None
    promo_ativa: bool = False
    desconto_pct: int | None = None
    promo_inicio: str | None = None
    promo_fim: str | None = None
    preco_atual: str
    embalagem_grande: bool
    ordem: int


class CmsProdutoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    departamento_id: str
    departamento_nome: str | None = None
    departamento_slug: str | None = None
    nome: str
    slug: str
    marca: str
    tamanho: str
    descricao: str
    como_usar: str
    forma: str
    cor: str
    imagem_url: str | None
    imagem_posicao: str
    imagem_zoom: int
    preco_de: str
    preco_por: str | None = None
    promo_inicio: str | None = None
    promo_fim: str | None = None
    promo_ativa: bool = False
    desconto_pct: int | None = None
    preco_atual: str
    embalagem_grande: bool
    ordem: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ==============================================================================
# KITS
# ==============================================================================


class KitItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    produto_id: str
    quantidade: int = Field(default=1, ge=1)
    ordem: int = Field(default=0)


class KitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str = Field(..., min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    descricao: str = Field(default="")
    publico: str = Field(default="empresa", max_length=40)
    ordem: int = Field(default=0)
    is_active: bool = Field(default=True)
    itens: list[KitItemCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def populate_slug(self) -> "KitCreate":
        if not self.slug:
            self.slug = slugify(self.nome)
        return self


class KitUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nome: str | None = Field(default=None, min_length=2, max_length=120)
    slug: str | None = Field(default=None, max_length=120)
    descricao: str | None = None
    publico: str | None = Field(default=None, max_length=40)
    ordem: int | None = None
    is_active: bool | None = None
    itens: list[KitItemCreate] | None = None


class KitItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    produto_id: str
    produto: PublicProdutoResponse | None = None
    quantidade: int
    ordem: int


class PublicKitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nome: str
    slug: str
    descricao: str
    publico: str
    ordem: int
    itens: list[KitItemResponse] = Field(default_factory=list)


class CmsKitResponse(PublicKitResponse):
    is_active: bool
    created_at: datetime
    updated_at: datetime
