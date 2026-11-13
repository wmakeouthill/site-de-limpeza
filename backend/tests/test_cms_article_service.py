
import pytest

from app.application.services.cms_article_service import CmsArticleService
from app.application.services.public_content_service import PublicContentService
from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope
from app.domain.schemas.content import ArticleCreate, ArticleDetailInput
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.security.cms_session import CmsUser


class FakeContentRepository:
    def __init__(self):
        self.entries: dict[str, ContentEntry] = {}

    async def save(self, content_entry: ContentEntry) -> ContentEntry:
        if not content_entry.id:
            content_entry.id = "generated-id"
        self.entries[content_entry.id] = content_entry
        return content_entry

    async def find_by_id(self, content_entry_id: str) -> ContentEntry | None:
        return self.entries.get(content_entry_id)

    async def find_published_by_slug(
        self,
        content_type: ContentType,
        slug: str,
        site: SiteScope = SiteScope.FALCAO,
    ) -> ContentEntry | None:
        return next(
            (
                entry
                for entry in self.entries.values()
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
        return [
            entry
            for entry in self.entries.values()
            if (not content_type or entry.content_type == content_type)
            and (not status or entry.status == status)
        ]

    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        for entry in self.entries.values():
            if entry.published_by == author_email:
                entry.published_author_image_url = photo_url

    async def delete(self, content_entry: ContentEntry) -> None:
        self.entries.pop(content_entry.id, None)


@pytest.mark.asyncio
async def test_create_article_saves_draft_with_editor_fields() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)

    article = await service.create_article(create_payload(), create_user())

    assert article.status == ContentStatus.DRAFT
    assert article.title == "Agentes de IA"
    assert article.area == "Estrategia"
    assert article.thumbnail_url == "/assets/article-1.png"
    storage_key = repository.entries[article.id].article_detail.thumbnail_asset.storage_key
    assert storage_key != article.thumbnail_url
    assert storage_key.startswith("external/article-thumbnails/")


@pytest.mark.asyncio
async def test_create_article_preserves_falcao_site() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    payload = create_payload()
    payload.site = SiteScope.FALCAO

    article = await service.create_article(payload, create_user())

    assert article.site == SiteScope.FALCAO
    assert repository.entries[article.id].site == SiteScope.FALCAO


@pytest.mark.asyncio
async def test_create_article_preserves_uploaded_asset_id() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    payload = create_payload()
    payload.article_detail.thumbnail_asset_id = "thumbnail-id"

    article = await service.create_article(payload, create_user())

    detail = repository.entries[article.id].article_detail
    assert article.thumbnail_asset_id == "thumbnail-id"
    assert detail.thumbnail_asset is None


@pytest.mark.asyncio
async def test_update_article_changes_markdown_and_reading_time() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    article = await service.create_article(create_payload(), create_user())

    updated_article = await service.update_article(
        article.id,
        create_payload(title="Novo titulo", body_markdown="Novo corpo", reading_time="9 min"),
        create_user(),
    )

    assert updated_article.title == "Novo titulo"
    assert updated_article.body_markdown == "Novo corpo"
    assert updated_article.reading_time == "9 min"


@pytest.mark.asyncio
async def test_publish_and_unpublish_article_changes_status() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    article = await service.create_article(create_payload(), create_user())

    published_article = await service.publish_article(article.id, create_user())
    unpublished_article = await service.unpublish_article(article.id, create_user())

    assert published_article.status == ContentStatus.PUBLISHED
    assert published_article.published_author_name == "Editor"
    assert published_article.published_author_image_url == "/uploads/editor.png"
    assert unpublished_article.status == ContentStatus.DRAFT
    assert unpublished_article.published_author_name == "Editor"
    assert unpublished_article.published_author_image_url == "/uploads/editor.png"


@pytest.mark.asyncio
async def test_publish_and_unpublish_article_updates_public_response() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    cms_service = CmsArticleService(repository, cache)
    public_service = PublicContentService(repository, cache)
    article = await cms_service.create_article(create_payload(), create_user())

    assert await public_service.get_article_by_slug("agentes-ia") is None

    await cms_service.publish_article(article.id, create_user())
    published_article = await public_service.get_article_by_slug("agentes-ia")

    assert published_article is not None
    assert published_article.title == "Agentes de IA"

    await cms_service.unpublish_article(article.id, create_user())

    assert await public_service.get_article_by_slug("agentes-ia") is None


@pytest.mark.asyncio
async def test_archive_and_unarchive_article_returns_to_draft() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    article = await service.create_article(create_payload(), create_user())

    archived_article = await service.archive_article(article.id, create_user())
    restored_article = await service.unarchive_article(article.id, create_user())

    assert archived_article.status == ContentStatus.ARCHIVED
    assert restored_article.status == ContentStatus.DRAFT


@pytest.mark.asyncio
async def test_delete_article_removes_entry() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    article = await service.create_article(create_payload(), create_user())

    await service.delete_article(article.id)

    assert article.id not in repository.entries


@pytest.mark.asyncio
async def test_update_published_article_invalidates_old_and_new_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsArticleService(repository, cache)
    article = await service.create_article(create_payload(), create_user())
    await service.publish_article(article.id, create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/artigos", {"articles"})
    await seed_cache(cache, "html:/artigos/agentes-ia", {"article:agentes-ia"})
    await seed_cache(cache, "html:/artigos/agentes-ia-novo", {"article:agentes-ia-novo"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.update_article(article.id, create_payload(slug="agentes-ia-novo"), create_user())

    for key in (
        "html:/",
        "html:/artigos",
        "html:/artigos/agentes-ia",
        "html:/artigos/agentes-ia-novo",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


@pytest.mark.asyncio
async def test_publish_article_invalidates_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsArticleService(repository, cache)
    article = await service.create_article(create_payload(), create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/artigos", {"articles"})
    await seed_cache(cache, "html:/artigos/agentes-ia", {"article:agentes-ia"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.publish_article(article.id, create_user())

    for key in (
        "html:/",
        "html:/artigos",
        "html:/artigos/agentes-ia",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


@pytest.mark.asyncio
async def test_unpublish_article_invalidates_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsArticleService(repository, cache)
    article = await service.create_article(create_payload(), create_user())
    await service.publish_article(article.id, create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/artigos", {"articles"})
    await seed_cache(cache, "html:/artigos/agentes-ia", {"article:agentes-ia"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.unpublish_article(article.id, create_user())

    for key in (
        "html:/",
        "html:/artigos",
        "html:/artigos/agentes-ia",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


@pytest.mark.asyncio
async def test_create_article_mirrors_seo_from_title_and_excerpt() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    payload = create_payload()
    payload.seo_title = "SEO do cliente"
    payload.seo_description = "Descricao do cliente"

    article = await service.create_article(payload, create_user())

    assert article.seo_title == "Agentes de IA"
    assert article.seo_description == "Resumo"
    assert repository.entries[article.id].seo_title == "Agentes de IA"
    assert repository.entries[article.id].seo_description == "Resumo"


@pytest.mark.asyncio
async def test_update_article_mirrors_seo_from_title_and_excerpt() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    article = await service.create_article(create_payload(), create_user())
    payload = create_payload(title="Titulo novo")
    payload.excerpt = "Resumo novo"
    payload.seo_title = "Ignorado"
    payload.seo_description = "Tambem ignorado"

    updated = await service.update_article(article.id, payload, create_user())

    assert updated.seo_title == "Titulo novo"
    assert updated.seo_description == "Resumo novo"


@pytest.mark.asyncio
async def test_publish_uses_declared_author_not_publisher() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    payload = create_payload()
    payload.author_name = "Ghost"
    payload.author_image_url = "/uploads/ghost.png"
    payload.author_email = "ghost@example.com"
    article = await service.create_article(payload, create_user())
    publisher = CmsUser(
        email="publisher@example.com",
        name="Publisher",
        object_id="publisher-id",
        photo_url="/uploads/publisher.png",
    )

    published = await service.publish_article(article.id, publisher)

    assert published.status == ContentStatus.PUBLISHED
    assert published.published_author_name == "Ghost"
    assert published.published_author_image_url == "/uploads/ghost.png"
    assert published.published_by == "ghost@example.com"


@pytest.mark.asyncio
async def test_unpublish_preserves_declared_author() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)
    payload = create_payload()
    payload.author_name = "Ghost"
    payload.author_image_url = "/uploads/ghost.png"
    article = await service.create_article(payload, create_user())
    await service.publish_article(article.id, create_user())

    unpublished = await service.unpublish_article(article.id, create_user())

    assert unpublished.status == ContentStatus.DRAFT
    assert unpublished.published_author_name == "Ghost"
    assert unpublished.published_author_image_url == "/uploads/ghost.png"
    assert unpublished.published_at is None


@pytest.mark.asyncio
async def test_create_article_defaults_author_to_session_user() -> None:
    repository = FakeContentRepository()
    service = CmsArticleService(repository)

    article = await service.create_article(create_payload(), create_user())

    assert article.published_author_name == "Editor"
    assert article.published_author_image_url == "/uploads/editor.png"
    assert article.published_by == "editor@example.com"


def create_payload(
    slug: str = "agentes-ia",
    title: str = "Agentes de IA",
    body_markdown: str = "Conteudo",
    reading_time: str = "8 min",
) -> ArticleCreate:
    return ArticleCreate(
        slug=slug,
        title=title,
        excerpt="Resumo",
        body_markdown=body_markdown,
        cover_asset_id=None,
        seo_title=title,
        seo_description="Descricao",
        article_detail=ArticleDetailInput(
            area="Estrategia",
            reading_time=reading_time,
            thumbnail_url="/assets/article-1.png",
        ),
    )


def create_user() -> CmsUser:
    return CmsUser(
        email="editor@example.com",
        name="Editor",
        object_id="user-id",
        photo_url="/uploads/editor.png",
    )


async def seed_cache(cache: PublicCacheStore, key: str, tags: set[str]) -> None:
    await cache.set(key=key, value=key, ttl_seconds=60, stale_seconds=60, tags=tags)


class FakeIndexNow:
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    async def submit_paths(self, paths: list[str]) -> None:
        self.calls.append(paths)


@pytest.mark.asyncio
async def test_publish_and_unpublish_article_ping_indexnow_but_draft_does_not() -> None:
    indexnow = FakeIndexNow()
    service = CmsArticleService(FakeContentRepository(), indexnow=indexnow)
    entry = await service.create_article(create_payload(), create_user())

    await service.publish_article(entry.id, create_user())
    await service.unpublish_article(entry.id, create_user())

    expected = ["/", "/artigos", f"/artigos/{entry.slug}"]
    assert indexnow.calls == [expected, expected]
