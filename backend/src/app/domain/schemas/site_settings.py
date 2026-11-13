from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HorarioFuncionamento(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dias_semana: list[int] = Field(..., description="0 = domingo, ..., 6 = sábado")
    abre: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    fecha: str = Field(..., pattern=r"^\d{2}:\d{2}$")


class PublicSiteSettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loja_nome: str = "Falcão Limpeza"
    razao_social: str | None = None
    cnpj: str | None = None
    whatsapp_numero: str = "5521999999999"
    telefone_exibicao: str | None = "(21) 99999-9999"
    endereco: str = "Estrada de Jacarepaguá, 5171"
    bairro_cidade: str = "Anil, Rio de Janeiro - RJ"
    referencia_endereco: str | None = "pertinho de Rio das Pedras"
    maps_url: str | None = None
    horarios: list[HorarioFuncionamento] = Field(default_factory=list)
    horario_obs: str | None = None
    pagamento: str = "Dinheiro, Pix, cartões de débito e crédito"
    chave_pix: str | None = None
    bairros_entrega: list[str] = Field(default_factory=list)
    prazo_separacao: str | None = "Separado em ~30 min"
    instagram_url: str | None = None
    articles_enabled: bool = True
    guides_enabled: bool = True
    testimonials_enabled: bool = True


class SiteSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loja_nome: str = Field(default="Falcão Limpeza", max_length=40)
    razao_social: str | None = Field(default=None, max_length=120)
    cnpj: str | None = Field(default=None, max_length=20)
    whatsapp_numero: str = Field(default="5521999999999", min_length=12, max_length=20)
    telefone_exibicao: str | None = Field(default=None, max_length=20)
    endereco: str = Field(default="Estrada de Jacarepaguá, 5171", max_length=120)
    bairro_cidade: str = Field(default="Anil, Rio de Janeiro - RJ", max_length=60)
    referencia_endereco: str | None = Field(default=None, max_length=80)
    maps_url: str | None = Field(default=None, max_length=500)
    horarios: list[HorarioFuncionamento] = Field(default_factory=list)
    horario_obs: str | None = Field(default=None, max_length=80)
    pagamento: str = Field(default="Dinheiro, Pix, cartões de débito e crédito", max_length=160)
    chave_pix: str | None = Field(default=None, max_length=100)
    bairros_entrega: list[str] = Field(default_factory=list)
    prazo_separacao: str | None = Field(default=None, max_length=40)
    instagram_url: str | None = Field(default=None, max_length=500)
    articles_enabled: Any = Field(default=True)
    guides_enabled: bool = Field(default=True)

    @field_validator("whatsapp_numero")
    @classmethod
    def validate_whatsapp(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if not (digits.startswith("55") and 12 <= len(digits) <= 13):
            raise ValueError(
                "WhatsApp deve conter apenas dígitos, iniciar com DDI 55 e ter 12 ou 13 dígitos."
            )
        return digits

    @field_validator("maps_url", "instagram_url")
    @classmethod
    def validate_https_url(cls, v: str | None) -> str | None:
        if v is not None:
            clean = v.strip()
            if not clean:
                return None
            if not clean.startswith("https://"):
                raise ValueError("URL deve começar com 'https://'.")
            return clean
        return None

    @field_validator("bairros_entrega")
    @classmethod
    def validate_bairros(cls, v: list[str]) -> list[str]:
        if len(v) > 60:
            raise ValueError("No máximo 60 bairros podem ser informados.")
        cleaned: list[str] = []
        for bairro in v:
            clean = bairro.strip()
            if clean:
                if len(clean) > 40:
                    raise ValueError(f"Nome de bairro excede 40 caracteres: '{clean}'.")
                cleaned.append(clean)
        return cleaned

    @field_validator("articles_enabled", mode="before")
    @classmethod
    def parse_articles_enabled(cls, v: Any) -> bool:
        if isinstance(v, dict):
            return bool(v.get("falcao", v.get("talimpo", True)))
        return bool(v)


class SiteSettingsResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loja_nome: str
    razao_social: str | None = None
    cnpj: str | None = None
    whatsapp_numero: str
    telefone_exibicao: str | None = None
    endereco: str
    bairro_cidade: str
    referencia_endereco: str | None = None
    maps_url: str | None = None
    horarios: list[HorarioFuncionamento]
    horario_obs: str | None = None
    pagamento: str
    chave_pix: str | None = None
    bairros_entrega: list[str]
    prazo_separacao: str | None = None
    instagram_url: str | None = None
    articles_enabled: Any
    guides_enabled: bool
    testimonials_enabled: bool
    updated_at: datetime | None = None
    updated_by: str | None = None
