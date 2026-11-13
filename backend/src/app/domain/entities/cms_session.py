from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.database.base import Base


def generate_session_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class CmsSession(Base):
    """Sessao administrativa persistida para rotacao de refresh token e revogacao."""

    __tablename__ = "cms_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_session_id)
    user_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    user_object_id: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    user_photo_url: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    refresh_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    csrf_token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    def is_active(self, now: datetime | None = None) -> bool:
        current = now or utc_now()
        expires = (
            self.expires_at
            if self.expires_at.tzinfo is not None
            else self.expires_at.replace(tzinfo=UTC)
        )
        return self.revoked_at is None and expires > current

    def revoke(self, now: datetime | None = None) -> None:
        current = now or utc_now()
        if self.revoked_at is None:
            self.revoked_at = current
        self.updated_at = current
