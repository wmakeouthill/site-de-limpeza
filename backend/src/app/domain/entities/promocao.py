from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.entities.enums import Frequencia, PublicoPromocao, TipoAcao
from app.infrastructure.database.base import Base

if TYPE_CHECKING:
    from app.domain.entities.catalog import Produto


def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Promocao(Base):
    __tablename__ = "promocoes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    titulo: Mapped[str] = mapped_column(String(120), nullable=False)
    texto: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    imagem_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tipo_acao: Mapped[str] = mapped_column(
        String(20), nullable=False, default=TipoAcao.AVISO.value
    )
    produto_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("produtos.id", ondelete="SET NULL"), nullable=True
    )
    cta_texto: Mapped[str | None] = mapped_column(String(60), nullable=True, default="")
    cta_caminho: Mapped[str | None] = mapped_column(String(255), nullable=True, default="")
    codigo_cupom: Mapped[str | None] = mapped_column(String(50), nullable=True, default="")
    whatsapp_mensagem: Mapped[str | None] = mapped_column(
        String(300), nullable=True, default=""
    )
    publico: Mapped[str] = mapped_column(
        String(20), nullable=False, default=PublicoPromocao.TODOS.value
    )
    frequencia: Mapped[str] = mapped_column(
        String(20), nullable=False, default=Frequencia.UMA_VEZ.value
    )
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_fim: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    prioridade: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    produto: Mapped["Produto | None"] = relationship("Produto", foreign_keys=[produto_id])

    __table_args__ = (
        Index("ix_promocoes_active_dates", "is_active", "data_inicio", "data_fim", "prioridade"),
        Index("ix_promocoes_publico", "publico"),
    )
