from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.entities.enums import Forma, Icone
from app.infrastructure.database.base import Base


def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Departamento(Base):
    __tablename__ = "departamentos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    icone: Mapped[str] = mapped_column(String(20), nullable=False, default=Icone.DROP.value)
    uso: Mapped[str | None] = mapped_column(String(255), nullable=True, default="")
    cuidado: Mapped[str | None] = mapped_column(String(255), nullable=True, default="")
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    produtos: Mapped[list["Produto"]] = relationship(
        "Produto", back_populates="departamento", order_by="Produto.ordem"
    )

    __table_args__ = (
        Index("ix_departamentos_active_ordem", "is_active", "ordem"),
    )


class Produto(Base):
    __tablename__ = "produtos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    departamento_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("departamentos.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    marca: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    tamanho: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    descricao: Mapped[str] = mapped_column(Text, nullable=False, default="")
    como_usar: Mapped[str] = mapped_column(Text, nullable=False, default="")
    forma: Mapped[str] = mapped_column(String(20), nullable=False, default=Forma.GARRAFA.value)
    cor: Mapped[str] = mapped_column(String(7), nullable=False, default="#003399")
    imagem_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    imagem_posicao: Mapped[str] = mapped_column(String(20), nullable=False, default="center")
    imagem_zoom: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    preco_de: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    preco_por: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    promo_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    promo_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    embalagem_grande: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    departamento: Mapped["Departamento"] = relationship("Departamento", back_populates="produtos")
    kit_itens: Mapped[list["KitItem"]] = relationship("KitItem", back_populates="produto")

    __table_args__ = (
        Index("ix_produtos_dept_active_ordem", "departamento_id", "is_active", "ordem"),
        Index("ix_produtos_active_ordem", "is_active", "ordem"),
        Index("ix_produtos_preco_por", "preco_por"),
    )


class Kit(Base):
    __tablename__ = "kits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    descricao: Mapped[str] = mapped_column(Text, nullable=False, default="")
    publico: Mapped[str] = mapped_column(String(40), nullable=False, default="empresa")
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    itens: Mapped[list["KitItem"]] = relationship(
        "KitItem", back_populates="kit", cascade="all, delete-orphan", order_by="KitItem.ordem"
    )

    __table_args__ = (
        Index("ix_kits_active_ordem", "is_active", "ordem"),
    )


class KitItem(Base):
    __tablename__ = "kit_itens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    kit_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("kits.id", ondelete="CASCADE"), nullable=False, index=True
    )
    produto_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("produtos.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    kit: Mapped["Kit"] = relationship("Kit", back_populates="itens")
    produto: Mapped["Produto"] = relationship("Produto", back_populates="kit_itens")

    __table_args__ = (
        Index("ix_kit_itens_kit_ordem", "kit_id", "ordem"),
    )
