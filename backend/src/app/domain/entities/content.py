from datetime import UTC, datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.entities.site import SiteScope
from app.domain.exceptions.content import InvalidContentPublicationError
from app.infrastructure.database.base import Base

if TYPE_CHECKING:
    from app.domain.entities.guide import GuideDetail, GuideProduto



def generate_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class ContentType(StrEnum):
    ARTICLE = "article"
    CASE = "case"
    GUIDE = "guide"


class ContentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ContentAsset(Base):
    __tablename__ = "content_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    public_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    alt_text: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ContentEntry(Base):
    __tablename__ = "content_entries"
    __table_args__ = (
        UniqueConstraint(
            "site", "slug", "content_type", name="uq_content_entries_site_slug_type"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    content_type: Mapped[ContentType] = mapped_column(String(20), nullable=False)
    site: Mapped[SiteScope] = mapped_column(
        String(20),
        nullable=False,
        default=SiteScope.FALCAO,
        server_default="falcao",
    )
    status: Mapped[ContentStatus] = mapped_column(
        String(20),
        nullable=False,
        default=ContentStatus.DRAFT,
    )
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    excerpt: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    body_markdown: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    cover_asset: Mapped[ContentAsset | None] = relationship(foreign_keys=[cover_asset_id])
    seo_title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    seo_description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Data da PRIMEIRA publicaÃ§Ã£o. Gravada uma Ãºnica vez e nunca limpa â€” nÃ£o se
    # move ao republicar/despublicar/arquivar (diferente de published_at).
    first_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_by: Mapped[str] = mapped_column(String(255), nullable=False)
    published_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_author_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_author_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    article_detail: Mapped["ArticleDetail | None"] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        single_parent=True,
    )
    case_detail: Mapped["CaseDetail | None"] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        single_parent=True,
    )
    case_metrics: Mapped[list["CaseMetric"]] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        order_by="CaseMetric.sort_order",
    )
    case_tags: Mapped[list["CaseTag"]] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        order_by="CaseTag.sort_order",
    )
    article_likes: Mapped[list["ArticleLike"]] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
    )
    guide_detail: Mapped["GuideDetail | None"] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        single_parent=True,
    )
    guide_produtos: Mapped[list["GuideProduto"]] = relationship(
        back_populates="content_entry",
        cascade="all, delete-orphan",
        order_by="GuideProduto.ordem",
    )

    def publish(
        self,
        published_by: str,
        author_name: str = "",
        author_image_url: str = "",
        published_at: datetime | None = None,
    ) -> None:
        if self.status == ContentStatus.ARCHIVED:
            raise InvalidContentPublicationError("Conteudo arquivado nao pode ser publicado.")

        self._ensure_publishable()
        self.status = ContentStatus.PUBLISHED
        self.published_by = published_by
        self.published_author_name = author_name or published_by
        self.published_author_image_url = author_image_url or None
        self.published_at = published_at or utc_now()
        # Primeira publicaÃ§Ã£o Ã© sticky: sÃ³ grava se ainda nÃ£o houver uma.
        if self.first_published_at is None:
            self.first_published_at = self.published_at
        self.updated_by = published_by
        self.updated_at = utc_now()

    def unpublish(self, updated_by: str) -> None:
        if self.status != ContentStatus.PUBLISHED:
            return

        self.status = ContentStatus.DRAFT
        # published_by / author fields permanecem: email do autor declarado
        # (nao forcar reescolha ao republicar).
        self.published_at = None
        self.updated_by = updated_by
        self.updated_at = utc_now()

    def archive(self, updated_by: str) -> None:
        self.status = ContentStatus.ARCHIVED
        # Autor editorial (nome/imagem/email) permanece no archive.
        self.published_at = None
        self.updated_by = updated_by
        self.updated_at = utc_now()

    def unarchive(self, updated_by: str) -> None:
        if self.status != ContentStatus.ARCHIVED:
            return

        self.status = ContentStatus.DRAFT
        self.updated_by = updated_by
        self.updated_at = utc_now()

    def _ensure_publishable(self) -> None:
        required_fields = {
            "slug": self.slug,
            "title": self.title,
            "body_markdown": self.body_markdown,
        }
        missing_fields = [field for field, value in required_fields.items() if not value.strip()]
        if missing_fields:
            fields = ", ".join(missing_fields)
            raise InvalidContentPublicationError(f"Campos obrigatorios ausentes: {fields}.")


class ArticleDetail(Base):
    __tablename__ = "article_details"

    content_entry_id: Mapped[str] = mapped_column(
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    categoria: Mapped[str] = mapped_column(String(30), nullable=False, default="geral", server_default="geral")
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    reading_time: Mapped[str] = mapped_column(String(40), nullable=False)
    thumbnail_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    thumbnail_asset: Mapped[ContentAsset | None] = relationship(foreign_keys=[thumbnail_asset_id])
    thumbnail_position_x: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    thumbnail_position_y: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    thumbnail_zoom: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    content_entry: Mapped[ContentEntry] = relationship(back_populates="article_detail")


class ArticleLike(Base):
    __tablename__ = "article_likes"
    __table_args__ = (
        UniqueConstraint(
            "content_entry_id",
            "visitor_id_hash",
            name="uq_article_likes_entry_visitor",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    content_entry_id: Mapped[str] = mapped_column(
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    visitor_id_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    content_entry: Mapped[ContentEntry] = relationship(back_populates="article_likes")


class CaseDetail(Base):
    __tablename__ = "case_details"

    content_entry_id: Mapped[str] = mapped_column(
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    topic: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    client_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    client_logo_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_logo_asset: Mapped[ContentAsset | None] = relationship(
        foreign_keys=[client_logo_asset_id],
    )
    company_icon_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    company_icon_asset: Mapped[ContentAsset | None] = relationship(
        foreign_keys=[company_icon_asset_id],
    )
    screenshot_asset_id: Mapped[str | None] = mapped_column(
        ForeignKey("content_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    screenshot_asset: Mapped[ContentAsset | None] = relationship(foreign_keys=[screenshot_asset_id])
    screenshot_position_x: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    screenshot_position_y: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    screenshot_zoom: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    content_entry: Mapped[ContentEntry] = relationship(back_populates="case_detail")


class CaseMetric(Base):
    __tablename__ = "case_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    content_entry_id: Mapped[str] = mapped_column(
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    value: Mapped[str] = mapped_column(String(40), nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    content_entry: Mapped[ContentEntry] = relationship(back_populates="case_metrics")


class CaseTag(Base):
    __tablename__ = "case_tags"
    __table_args__ = (
        UniqueConstraint("content_entry_id", "label", name="uq_case_tags_entry_label"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    content_entry_id: Mapped[str] = mapped_column(
        ForeignKey("content_entries.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    content_entry: Mapped[ContentEntry] = relationship(back_populates="case_tags")
