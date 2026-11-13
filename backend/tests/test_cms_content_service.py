import pytest

from app.application.services.cms_content_service import CmsContentService
from app.domain.entities.content import ArticleDetail, ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope


class FakeContentRepository:
    def __init__(self, entries: list[ContentEntry]):
        self.entries = entries
        self.requested_content_type: ContentType | None = None
        self.requested_status: ContentStatus | None = None

    async def save(self, content_entry: ContentEntry) -> ContentEntry:
        self.entries.append(content_entry)
        return content_entry

    async def find_by_id(self, content_entry_id: str) -> ContentEntry | None:
        return next((entry for entry in self.entries if entry.id == content_entry_id), None)

    async def find_published_by_slug(
        self,
        content_type: ContentType,
        slug: str,
    ) -> ContentEntry | None:
        return next(
            (
                entry
                for entry in self.entries
                if entry.content_type == content_type
                and entry.status == ContentStatus.PUBLISHED
                and entry.slug == slug
            ),
            None,
        )

    async def list_by_status(
        self,
        content_type: ContentType | None = None,
        status: ContentStatus | None = None,
        site: SiteScope = SiteScope.FALCAO,
    ) -> list[ContentEntry]:
        self.requested_content_type = content_type
        self.requested_status = status
        self.requested_site = site
        return [
            entry
            for entry in self.entries
            if (not content_type or entry.content_type == content_type)
            and (not status or entry.status == status)
        ]

    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        for entry in self.entries:
            if entry.published_by == author_email:
                entry.published_author_image_url = photo_url


@pytest.mark.asyncio
async def test_list_content_forwards_type_and_status_filters() -> None:
    repository = FakeContentRepository([create_article_entry()])
    service = CmsContentService(repository)

    response = await service.list_content(ContentType.ARTICLE, ContentStatus.PUBLISHED)

    assert repository.requested_content_type == ContentType.ARTICLE
    assert repository.requested_status == ContentStatus.PUBLISHED
    assert response.total == 1
    assert response.items[0].detail_label == "Estrategia"


def create_article_entry() -> ContentEntry:
    entry = ContentEntry(
        id="agentes-ia",
        content_type=ContentType.ARTICLE,
        status=ContentStatus.PUBLISHED,
        site=SiteScope.FALCAO,
        slug="agentes-ia",
        title="Agentes de IA",
        excerpt="Resumo",
        body_markdown="Conteudo",
        created_by="editor@example.com",
        updated_by="editor@example.com",
    )
    entry.article_detail = ArticleDetail(area="Estrategia", reading_time="8 min")
    return entry
