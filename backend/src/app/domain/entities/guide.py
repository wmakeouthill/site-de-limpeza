from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.entities.enums import PublicoGuia
from app.infrastructure.database.base import Base

if TYPE_CHECKING:
    from app.domain.entities.catalog import Produto
    from app.domain.entities.content import ContentEntry


def generate_id() -> str:
    return str(uuid4())


class GuideDetail(Base):
    __tablename__ = "guide_details"

    content_entry_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    publico: Mapped[PublicoGuia] = mapped_column(
        String(20),
        nullable=False,
        default=PublicoGuia.AMBOS,
        server_default="ambos",
    )
    tempo_minutos: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    etiqueta: Mapped[str] = mapped_column(String(24), nullable=False, default="")
    icone: Mapped[str] = mapped_column(String(50), nullable=False, default="sparkle")
    dificuldade: Mapped[str] = mapped_column(String(30), nullable=False, default="Fácil")

    content_entry: Mapped["ContentEntry"] = relationship(back_populates="guide_detail")


class GuideProduto(Base):
    __tablename__ = "guide_produtos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    guide_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    produto_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("produtos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    content_entry: Mapped["ContentEntry"] = relationship(back_populates="guide_produtos")
    produto: Mapped["Produto"] = relationship("Produto")
