from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.entities.site import SiteScope
from app.infrastructure.database.base import Base


def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class Testimonial(Base):
    """Depoimento exibido na home do site.

    Mora no banco local de metricas (mesmo caminho de `campaign_source_links`):
    uma implementacao so, sem ABC de dominio e sem variante aura.
    """

    __test__ = False

    __tablename__ = "testimonials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    # Tipado SiteScope e gravado como String(20), igual site_events e content.
    site: Mapped[SiteScope] = mapped_column(String(20), nullable=False)
    author: Mapped[str] = mapped_column(String(160), nullable=False)
    # Cargo e empresa convivem na mesma tabela: cada front renderiza o que usa.
    role: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    company: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    # Aceita **negrito** inline: o front quebra a citacao por "**".
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    youtube_id: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    avatar_url: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    __table_args__ = (
        Index("ix_testimonials_site_active_order", "site", "is_active", "sort_order"),
    )
