from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class CmsAuthor(Base):
    """Autor local do CMS (usuarios que ja autenticaram nesta aplicacao)."""

    __tablename__ = "cms_authors"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    photo_url: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    # Hash argon2id definido pelo comando `python -m app.cli set-password`; vazio = sem acesso.
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, default="", server_default=""
    )
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
