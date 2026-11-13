from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.domain.entities.content import ContentStatus, ContentType
from app.domain.entities.site import SiteScope


class ContentAssetResponse(BaseModel):
    id: str
    file_name: str
    mime_type: str
    size_bytes: int
    public_url: str
    alt_text: str

    model_config = ConfigDict(from_attributes=True)


class ContentEntryBase(BaseModel):
    slug: str = Field(..., min_length=1, max_length=180)
    title: str = Field(..., min_length=1, max_length=255)
    excerpt: str = Field(default="", max_length=500)
    body_markdown: str = Field(default="", max_length=262144)
    cover_asset_id: str | None = None
    seo_title: str = Field(default="", max_length=255)
    seo_description: str = Field(default="", max_length=500)


class ArticleDetailInput(BaseModel):
    categoria: str = Field(default="geral", max_length=30)
    area: str = Field(default="", max_length=100)
    reading_time: str = Field(..., min_length=1, max_length=40)
    thumbnail_asset_id: str | None = None
    thumbnail_url: str = Field(default="", max_length=1000)
    thumbnail_position_x: int = Field(default=50, ge=0, le=100)
    thumbnail_position_y: int = Field(default=50, ge=0, le=100)
    thumbnail_zoom: int = Field(default=100, ge=50, le=300)


class ArticleCreate(ContentEntryBase):
    site: SiteScope = SiteScope.FALCAO
    article_detail: ArticleDetailInput
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""


class ArticleUpdate(ContentEntryBase):
    article_detail: ArticleDetailInput
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""


class CaseMetricInput(BaseModel):
    prefix: str = Field(default="", max_length=20)
    value: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=160)
    sort_order: int = Field(default=0, ge=0)


class CaseTagInput(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    sort_order: int = Field(default=0, ge=0)


class CaseDetailInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: str = Field(..., min_length=1, max_length=160)
    screenshot_asset_id: str | None = None
    screenshot_url: str = Field(default="", max_length=1000)
    screenshot_position_x: int = Field(default=50, ge=0, le=100)
    screenshot_position_y: int = Field(default=50, ge=0, le=100)
    screenshot_zoom: int = Field(default=100, ge=50, le=300)


class CaseCreate(ContentEntryBase):
    model_config = ConfigDict(extra="forbid")

    site: SiteScope = SiteScope.FALCAO
    case_detail: CaseDetailInput
    tags: list[CaseTagInput] = Field(default_factory=list)
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""


class CaseUpdate(ContentEntryBase):
    model_config = ConfigDict(extra="forbid")

    case_detail: CaseDetailInput
    tags: list[CaseTagInput] = Field(default_factory=list)
    author_name: str = ""
    author_email: str | None = None
    author_image_url: str = ""



class ContentSummaryResponse(BaseModel):
    id: str
    content_type: ContentType
    status: ContentStatus
    slug: str
    title: str
    excerpt: str
    published_at: datetime | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContentEntryResponse(ContentSummaryResponse):
    body_markdown: str
    cover_asset_id: str | None
    seo_title: str
    seo_description: str
    created_at: datetime
    created_by: str
    updated_by: str
    published_by: str | None
    published_author_name: str | None = None
    published_author_image_url: str | None = None


class CmsArticleResponse(ContentEntryResponse):
    site: SiteScope
    categoria: str = "geral"
    area: str
    reading_time: str
    thumbnail_asset_id: str | None = None
    thumbnail_url: str
    thumbnail_position_x: int
    thumbnail_position_y: int
    thumbnail_zoom: int


class CmsCaseMetricResponse(BaseModel):
    prefix: str
    value: str
    label: str
    sort_order: int


class CmsCaseTagResponse(BaseModel):
    label: str
    sort_order: int


class CmsCaseResponse(ContentEntryResponse):
    site: SiteScope
    topic: str
    screenshot_asset_id: str | None = None
    screenshot_url: str
    screenshot_position_x: int
    screenshot_position_y: int
    screenshot_zoom: int
    tags: list[CmsCaseTagResponse]


class CmsContentSummaryResponse(BaseModel):
    id: str
    site: SiteScope
    content_type: ContentType
    status: ContentStatus
    slug: str
    title: str
    excerpt: str
    updated_at: datetime | None
    published_at: datetime | None
    detail_label: str


class CmsContentListResponse(BaseModel):
    items: list[CmsContentSummaryResponse]
    total: int


class PublicArticleCardResponse(BaseModel):
    id: str
    categoria: str = "geral"
    area: str
    reading_time: str
    title: str
    thumbnail: str
    thumbnail_alt: str = ""
    thumbnail_position_x: int = 50
    thumbnail_position_y: int = 50
    thumbnail_zoom: int = 100
    href: str
    slug: str
    first_published_at: datetime | None = None


class PublicArticleDetailResponse(PublicArticleCardResponse):
    excerpt: str
    body_markdown: str
    seo_title: str
    seo_description: str
    author: str
    author_image_url: str | None = None
    first_published_at: datetime | None
    published_at: datetime | None
    updated_at: datetime | None


class ArticleLikeStateResponse(BaseModel):
    liked: bool
    likes_count: int = Field(ge=0)


class PublicCaseMetricResponse(BaseModel):
    value: str
    label: str
    prefix: str | None = None


class PublicCaseCardResponse(BaseModel):
    id: str
    topic: str
    title: str
    tags: list[str]
    screenshot: str
    screenshot_alt: str = ""
    screenshot_position_x: int = 50
    screenshot_position_y: int = 50
    screenshot_zoom: int = 100
    slug: str
    first_published_at: datetime | None = None


class PublicCaseDetailResponse(PublicCaseCardResponse):
    excerpt: str
    body_markdown: str
    seo_title: str
    seo_description: str
    author: str
    first_published_at: datetime | None
    published_at: datetime | None
    updated_at: datetime | None

