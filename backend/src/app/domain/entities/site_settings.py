from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.entities.site import SiteScope
from app.infrastructure.database.base import Base

SITE_SETTINGS_ID = "site"
SITE_SETTINGS_SINGLETON_ID = SITE_SETTINGS_ID


def utc_now() -> datetime:
    return datetime.now(UTC)


class SiteSettings(Base):
    """Linha única (`id = 'site'`) com os dados da loja física e flags operacionais."""

    __tablename__ = "site_settings"

    id: Mapped[str] = mapped_column(
        String(32),
        primary_key=True,
        default=SITE_SETTINGS_SINGLETON_ID,
    )
    loja_nome: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="Falcão Limpeza",
        server_default="Falcão Limpeza",
    )
    razao_social: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )
    cnpj: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    whatsapp_numero: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="5521999999999",
        server_default="5521999999999",
    )
    telefone_exibicao: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        default="(21) 99999-9999",
        server_default="(21) 99999-9999",
    )
    endereco: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="Estrada de Jacarepaguá, 5171",
        server_default="Estrada de Jacarepaguá, 5171",
    )
    bairro_cidade: Mapped[str] = mapped_column(
        String(60),
        nullable=False,
        default="Anil, Rio de Janeiro - RJ",
        server_default="Anil, Rio de Janeiro - RJ",
    )
    referencia_endereco: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
        default="pertinho de Rio das Pedras",
        server_default="pertinho de Rio das Pedras",
    )
    maps_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    horarios: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    horario_obs: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )
    pagamento: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
        default="Dinheiro, Pix, cartões de débito e crédito",
        server_default="Dinheiro, Pix, cartões de débito e crédito",
    )
    chave_pix: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    bairros_entrega: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    prazo_separacao: Mapped[str | None] = mapped_column(
        String(40),
        nullable=True,
        default="Separado em ~30 min",
        server_default="Separado em ~30 min",
    )
    instagram_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    articles_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    guides_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
    updated_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="system",
    )

    def articles_enabled_for(self, site: SiteScope = SiteScope.FALCAO) -> bool:
        _ = site
        return self.articles_enabled

    def guides_enabled_for(self, site: SiteScope = SiteScope.FALCAO) -> bool:
        _ = site
        return self.guides_enabled
