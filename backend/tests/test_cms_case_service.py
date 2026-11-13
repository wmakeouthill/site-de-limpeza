
import pytest

from app.application.services.cms_case_service import CmsCaseService
from app.application.services.public_content_service import PublicContentService
from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope
from app.domain.exceptions.content import InvalidContentPublicationError
from app.domain.schemas.content import CaseCreate, CaseDetailInput, CaseTagInput
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
async def test_create_case_mirrors_seo_from_title_and_excerpt() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    payload = create_payload(title="Titulo do case")
    payload.excerpt = "Resumo do case"
    payload.seo_title = "SEO ignorado"
    payload.seo_description = "Descricao ignorada"

    case_entry = await service.create_case(payload, create_user())

    assert case_entry.seo_title == "Titulo do case"
    assert case_entry.seo_description == "Resumo do case"
    assert repository.entries[case_entry.id].seo_title == "Titulo do case"
    assert repository.entries[case_entry.id].seo_description == "Resumo do case"


@pytest.mark.asyncio
async def test_create_case_saves_draft_with_editor_fields() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)

    case_entry = await service.create_case(create_payload(), create_user())

    assert case_entry.status == ContentStatus.DRAFT
    assert case_entry.title == "Guia Prático: Defesa em Flagrante"
    assert case_entry.topic == "Direito Criminal"
    assert case_entry.screenshot_url == "/assets/case-isa.png"
    assert case_entry.tags[0].label == "OCR"


@pytest.mark.asyncio
async def test_create_case_preserves_uploaded_asset_ids() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    payload = create_payload()
    payload.case_detail.screenshot_asset_id = "screenshot-id"

    case_entry = await service.create_case(payload, create_user())

    detail = repository.entries[case_entry.id].case_detail
    assert case_entry.screenshot_asset_id == "screenshot-id"
    assert detail.screenshot_asset is None


@pytest.mark.asyncio
async def test_update_case_changes_tags_topic_and_markdown() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    case_entry = await service.create_case(create_payload(), create_user())

    updated_case = await service.update_case(
        case_entry.id,
        create_payload(
            title="Guia atualizado",
            body_markdown="Novo corpo",
            topic="Execução Penal",
            tags=[CaseTagInput(label="Habeas Corpus")],
        ),
        create_user(),
    )

    assert updated_case.title == "Guia atualizado"
    assert updated_case.body_markdown == "Novo corpo"
    assert updated_case.topic == "Execução Penal"
    assert updated_case.tags[0].label == "Habeas Corpus"


@pytest.mark.asyncio
async def test_update_case_keeps_existing_tag_rows_when_labels_do_not_change() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    case_entry = await service.create_case(create_payload(), create_user())
    first_tag_id = repository.entries[case_entry.id].case_tags[0].id

    updated_case = await service.update_case(
        case_entry.id,
        create_payload(title="Guia revisado"),
        create_user(),
    )

    assert updated_case.title == "Guia revisado"
    assert repository.entries[case_entry.id].case_tags[0].id == first_tag_id
    assert updated_case.tags[0].label == "OCR"


@pytest.mark.asyncio
async def test_publish_and_unpublish_case_changes_status() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    case_entry = await service.create_case(create_payload(), create_user())

    published_case = await service.publish_case(case_entry.id, create_user())
    unpublished_case = await service.unpublish_case(case_entry.id, create_user())

    assert published_case.status == ContentStatus.PUBLISHED
    assert published_case.published_author_name == "Editor"
    assert published_case.published_author_image_url == "/uploads/editor.png"
    assert unpublished_case.status == ContentStatus.DRAFT


@pytest.mark.asyncio
async def test_publish_and_unpublish_case_updates_public_response() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    cms_service = CmsCaseService(repository, cache)
    public_service = PublicContentService(repository, cache)
    case_entry = await cms_service.create_case(create_payload(), create_user())

    assert await public_service.get_case_by_slug("guia-defesa-flagrante") is None

    await cms_service.publish_case(case_entry.id, create_user())
    published_case = await public_service.get_case_by_slug("guia-defesa-flagrante")

    assert published_case is not None
    assert published_case.title == "Guia Prático: Defesa em Flagrante"

    await cms_service.unpublish_case(case_entry.id, create_user())

    assert await public_service.get_case_by_slug("guia-defesa-flagrante") is None


@pytest.mark.asyncio
async def test_archive_and_unarchive_case_returns_to_draft() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    case_entry = await service.create_case(create_payload(), create_user())

    archived_case = await service.archive_case(case_entry.id, create_user())
    restored_case = await service.unarchive_case(case_entry.id, create_user())

    assert archived_case.status == ContentStatus.ARCHIVED
    assert restored_case.status == ContentStatus.DRAFT


@pytest.mark.asyncio
async def test_delete_case_removes_entry() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)
    case_entry = await service.create_case(create_payload(), create_user())

    await service.delete_case(case_entry.id)

    assert case_entry.id not in repository.entries


@pytest.mark.asyncio
async def test_create_case_rejects_duplicate_tags() -> None:
    repository = FakeContentRepository()
    service = CmsCaseService(repository)

    with pytest.raises(InvalidContentPublicationError):
        await service.create_case(
            create_payload(tags=[CaseTagInput(label="OCR"), CaseTagInput(label="ocr")]),
            create_user(),
        )


@pytest.mark.asyncio
async def test_update_published_case_invalidates_old_and_new_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsCaseService(repository, cache)
    case_entry = await service.create_case(create_payload(), create_user())
    await service.publish_case(case_entry.id, create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/cases", {"cases"})
    await seed_cache(cache, "html:/cases/guia-defesa-flagrante", {"case:guia-defesa-flagrante"})
    await seed_cache(cache, "html:/cases/guia-defesa-flagrante-novo", {"case:guia-defesa-flagrante-novo"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.update_case(case_entry.id, create_payload(slug="guia-defesa-flagrante-novo"), create_user())

    for key in (
        "html:/",
        "html:/cases",
        "html:/cases/guia-defesa-flagrante",
        "html:/cases/guia-defesa-flagrante-novo",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


@pytest.mark.asyncio
async def test_publish_case_invalidates_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsCaseService(repository, cache)
    case_entry = await service.create_case(create_payload(), create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/cases", {"cases"})
    await seed_cache(cache, "html:/cases/guia-defesa-flagrante", {"case:guia-defesa-flagrante"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.publish_case(case_entry.id, create_user())

    for key in (
        "html:/",
        "html:/cases",
        "html:/cases/guia-defesa-flagrante",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


@pytest.mark.asyncio
async def test_unpublish_case_invalidates_public_cache() -> None:
    cache = PublicCacheStore(max_entries=20)
    repository = FakeContentRepository()
    service = CmsCaseService(repository, cache)
    case_entry = await service.create_case(create_payload(), create_user())
    await service.publish_case(case_entry.id, create_user())

    await seed_cache(cache, "html:/", {"home"})
    await seed_cache(cache, "html:/cases", {"cases"})
    await seed_cache(cache, "html:/cases/guia-defesa-flagrante", {"case:guia-defesa-flagrante"})
    await seed_cache(cache, "seo:sitemap.xml", {"sitemap"})

    await service.unpublish_case(case_entry.id, create_user())

    for key in (
        "html:/",
        "html:/cases",
        "html:/cases/guia-defesa-flagrante",
        "seo:sitemap.xml",
    ):
        assert (await cache.get(key)).status == "MISS"


def create_payload(
    slug: str = "guia-defesa-flagrante",
    title: str = "Guia Prático: Defesa em Flagrante",
    body_markdown: str = "Conteudo",
    tags: list[CaseTagInput] | None = None,
    topic: str = "Direito Criminal",
) -> CaseCreate:
    return CaseCreate(
        slug=slug,
        title=title,
        excerpt="Resumo",
        body_markdown=body_markdown,
        cover_asset_id=None,
        seo_title=title,
        seo_description="Descricao",
        case_detail=CaseDetailInput(
            topic=topic,
            screenshot_url="/assets/case-isa.png",
        ),
        tags=tags or [CaseTagInput(label="OCR"), CaseTagInput(label="Dados")],
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
async def test_publish_and_unpublish_case_ping_indexnow_but_draft_does_not() -> None:
    indexnow = FakeIndexNow()
    service = CmsCaseService(FakeContentRepository(), indexnow=indexnow)
    entry = await service.create_case(create_payload(), create_user())

    await service.publish_case(entry.id, create_user())
    await service.unpublish_case(entry.id, create_user())

    expected = ["/", "/guias", f"/guias/{entry.slug}"]
    assert indexnow.calls == [expected, expected]
