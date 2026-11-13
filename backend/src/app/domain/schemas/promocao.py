from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.entities.enums import Frequencia, PublicoPromocao, TipoAcao

TZ_SP = ZoneInfo("America/Sao_Paulo")


def agora_sao_paulo() -> datetime:
    """Retorna o timestamp atual no fuso horário oficial da loja (America/Sao_Paulo)."""
    return datetime.now(TZ_SP)


class PromocaoBase(BaseModel):
    titulo: str = Field(..., max_length=120)
    texto: str | None = Field(default="", max_length=500)
    imagem_url: str | None = Field(default=None, max_length=1000)
    tipo_acao: TipoAcao = Field(default=TipoAcao.AVISO)
    produto_id: str | None = None
    cta_texto: str | None = Field(default="", max_length=60)
    cta_caminho: str | None = Field(default="", max_length=255)
    codigo_cupom: str | None = Field(default="", max_length=50)
    whatsapp_mensagem: str | None = Field(default="", max_length=300)
    publico: PublicoPromocao = Field(default=PublicoPromocao.TODOS)
    frequencia: Frequencia = Field(default=Frequencia.UMA_VEZ)
    data_inicio: datetime
    data_fim: datetime
    prioridade: int = Field(default=0)
    is_active: bool = Field(default=True)

    @model_validator(mode="after")
    def validate_rules(self) -> "PromocaoBase":
        # 1. Validação de datas
        if self.data_fim < self.data_inicio:
            raise ValueError("Data final da promoção deve ser posterior ou igual à data inicial.")

        # 2. Validação estrita de caminho interno para link (CA-17)
        if self.tipo_acao == TipoAcao.LINK:
            caminho = (self.cta_caminho or "").strip()
            if not caminho:
                raise ValueError("Caminho do link é obrigatório quando tipo de ação é link.")
            # Deve ser relativo interno: começar com / e não conter //, \, ou esquemas de URL
            if not caminho.startswith("/") or caminho.startswith("//") or "\\" in caminho or ":" in caminho:
                raise ValueError(
                    "Caminho do link deve ser relativo interno começando com '/' e sem protocolos externos."
                )

        # 3. Validação de cupom
        if self.tipo_acao == TipoAcao.CUPOM:
            cupom = (self.codigo_cupom or "").strip()
            if not cupom or " " in cupom:
                raise ValueError("Código do cupom é obrigatório e não deve conter espaços.")

        # 4. Validação de produto
        if self.tipo_acao == TipoAcao.PRODUTO:
            if not self.produto_id or not self.produto_id.strip():
                raise ValueError("ID do produto é obrigatório quando tipo de ação é produto.")

        return self


class PromocaoCreate(PromocaoBase):
    pass


class PromocaoUpdate(BaseModel):
    titulo: str | None = Field(default=None, max_length=120)
    texto: str | None = Field(default=None, max_length=500)
    imagem_url: str | None = Field(default=None, max_length=1000)
    tipo_acao: TipoAcao | None = None
    produto_id: str | None = None
    cta_texto: str | None = Field(default=None, max_length=60)
    cta_caminho: str | None = Field(default=None, max_length=255)
    codigo_cupom: str | None = Field(default=None, max_length=50)
    whatsapp_mensagem: str | None = Field(default=None, max_length=300)
    publico: PublicoPromocao | None = None
    frequencia: Frequencia | None = None
    data_inicio: datetime | None = None
    data_fim: datetime | None = None
    prioridade: int | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_update(self) -> "PromocaoUpdate":
        if self.data_inicio and self.data_fim and self.data_fim < self.data_inicio:
            raise ValueError("Data final da promoção deve ser posterior ou igual à data inicial.")

        if self.tipo_acao == TipoAcao.LINK and self.cta_caminho is not None:
            caminho = self.cta_caminho.strip()
            if not caminho.startswith("/") or caminho.startswith("//") or "\\" in caminho or ":" in caminho:
                raise ValueError(
                    "Caminho do link deve ser relativo interno começando com '/' e sem protocolos externos."
                )

        if self.tipo_acao == TipoAcao.CUPOM and self.codigo_cupom is not None:
            cupom = self.codigo_cupom.strip()
            if not cupom or " " in cupom:
                raise ValueError("Código do cupom é obrigatório e não deve conter espaços.")

        return self


class PublicPromocaoRead(BaseModel):
    id: str
    titulo: str
    texto: str | None = None
    imagem_url: str | None = None
    tipo_acao: str
    produto_id: str | None = None
    cta_texto: str | None = None
    cta_caminho: str | None = None
    codigo_cupom: str | None = None
    whatsapp_mensagem: str | None = None
    publico: str
    frequencia: str
    prioridade: int
    data_inicio: datetime
    data_fim: datetime

    model_config = ConfigDict(from_attributes=True)


class CmsPromocaoRead(PromocaoBase):
    id: str
    situacao: str  # "no_ar", "agendada", "encerrada", "desligada"
    views_count: int
    clicks_count: int
    taxa_clique_pct: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
