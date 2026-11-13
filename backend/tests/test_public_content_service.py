import pytest

from app.application.services.public_content_service import PublicContentService
from app.domain.entities.content import (
    ArticleDetail,
    CaseDetail,
    CaseTag,
    ContentAsset,
    ContentEntry,
    ContentStatus,
    ContentType,
    utc_now,
)
from app.domain.entities.site import SiteScope
from app.infrastructure.cache.public_cache import PublicCacheStore


class FakeContentRepository:
    def __init__(self, entries: list[ContentEntry]):
        self.entries = entries
        self.requested_status: ContentStatus | None = None
        self.requested_content_type: ContentType | None = None
        self.requested_site: SiteScope | None = None
        self.find_calls = 0
        self.list_calls = 0

    async def save(self, content_entry: ContentEntry) -> ContentEntry:
        self.entries.append(content_entry)
        return content_entry

    async def find_by_id(self, content_entry_id: str) -> ContentEntry | None:
        return next((entry for entry in self.entries if entry.id == content_entry_id), None)

    async def find_published_by_slug(
        self,
        content_type: ContentType,
        slug: str,
        site: SiteScope = SiteScope.FALCAO,
    ) -> ContentEntry | None:
        self.find_calls += 1
        self.requested_site = site
        return next(
            (
                entry
                for entry in self.entries
                if entry.content_type == content_type
                and entry.status == ContentStatus.PUBLISHED
                and entry.slug == slug
                and entry.site == site
            ),
            None,
        )

    async def list_by_status(
        self,
        content_type: ContentType | None = None,
        status: ContentStatus | None = None,
        site: SiteScope = SiteScope.FALCAO,
    ) -> list[ContentEntry]:
        self.list_calls += 1
        self.requested_content_type = content_type
        self.requested_status = status
        self.requested_site = site
        return [
            entry
            for entry in self.entries
            if (not content_type or entry.content_type == content_type)
            and (not status or entry.status == status)
            and entry.site == site
        ]

    async def update_author_photo(self, author_email: str, photo_url: str) -> None:
        for entry in self.entries:
            if entry.published_by == author_email:
                entry.published_author_image_url = photo_url


@pytest.mark.asyncio
async def test_list_articles_requests_only_published_articles() -> None:
    repository = FakeContentRepository([create_article_entry()])
    service = PublicContentService(repository)

    articles = await service.list_articles()

    assert repository.requested_content_type == ContentType.ARTICLE
    assert repository.requested_status == ContentStatus.PUBLISHED
    assert articles[0].thumbnail == "/assets/article-1.png"
    assert articles[0].href == "/artigos/agentes-ia"


@pytest.mark.asyncio
async def test_get_article_by_slug_returns_public_metadata() -> None:
    service = PublicContentService(FakeContentRepository([create_article_entry()]))

    article = await service.get_article_by_slug("agentes-ia")

    assert article is not None
    assert article.author == "Lucas Fernandes"
    assert article.author_image_url == "/uploads/lucas.png"
    assert article.updated_at is not None


@pytest.mark.asyncio
async def test_data_cache_avoids_second_repository_call() -> None:
    repository = FakeContentRepository([create_article_entry()])
    cache = PublicCacheStore(max_entries=10)
    service = PublicContentService(repository, cache)

    first = await service.get_article_by_slug("agentes-ia")
    second = await service.get_article_by_slug("agentes-ia")

    assert first == second
    assert repository.find_calls == 1
    assert service.last_cache_status == "HIT"


@pytest.mark.asyncio
async def test_get_case_by_slug_returns_public_case_shape() -> None:
    case = create_case_entry()
    case.published_author_name = "Lucas Fernandes"
    service = PublicContentService(FakeContentRepository([case]))

    case_entry = await service.get_case_by_slug("guia-flagrante")

    assert case_entry is not None
    assert case_entry.topic == "Direito Criminal"
    assert case_entry.tags == ["OCR", "Dados"]
    assert case_entry.screenshot == "/assets/case-isa.png"
    assert case_entry.author == "Lucas Fernandes"


@pytest.mark.asyncio
async def test_get_article_by_slug_returns_none_when_not_published() -> None:
    service = PublicContentService(
        FakeContentRepository([create_article_entry(status=ContentStatus.DRAFT)])
    )

    article = await service.get_article_by_slug("agentes-ia")

    assert article is None


def create_asset(asset_id: str, public_url: str) -> ContentAsset:
    return ContentAsset(
        id=asset_id,
        file_name=public_url.rsplit("/", 1)[-1],
        mime_type="image/png",
        size_bytes=1,
        storage_key=public_url,
        public_url=public_url,
        created_by="test@falcaolimpeza.com.br",
    )


def create_article_entry(
    status: ContentStatus = ContentStatus.PUBLISHED,
    site: SiteScope = SiteScope.FALCAO,
) -> ContentEntry:
    entry = ContentEntry(
        id="agentes-ia",
        content_type=ContentType.ARTICLE,
        status=status,
        site=site,
        slug="agentes-ia",
        title="Agentes de IA",
        body_markdown="Conteudo",
        created_by="lucas.fernandes@falcaolimpeza.com.br",
        updated_by="lucas.fernandes@falcaolimpeza.com.br",
        published_by="lucas.fernandes@falcaolimpeza.com.br",
        published_author_name="Lucas Fernandes",
        published_author_image_url="/uploads/lucas.png",
        updated_at=utc_now(),
    )
    entry.article_detail = ArticleDetail(
        area="Estrategia",
        reading_time="8 min",
        thumbnail_asset=create_asset("article-asset", "/assets/article-1.png"),
    )
    return entry


def create_case_entry(
    site: SiteScope = SiteScope.FALCAO,
    slug: str = "guia-flagrante",
    entry_id: str = "guia-flagrante",
    topic: str = "Direito Criminal",
) -> ContentEntry:
    entry = ContentEntry(
        id=entry_id,
        content_type=ContentType.CASE,
        status=ContentStatus.PUBLISHED,
        site=site,
        slug=slug,
        title="Guia Prático: Defesa em Flagrante",
        body_markdown="Conteudo",
        created_by="admin@falcaolimpeza.com.br",
        updated_by="admin@falcaolimpeza.com.br",
    )
    entry.case_detail = CaseDetail(
        topic=topic,
        screenshot_asset=create_asset("case-shot", "/assets/case-isa.png"),
    )
    entry.case_tags = [CaseTag(label="OCR", sort_order=0), CaseTag(label="Dados", sort_order=1)]
    return entry


@pytest.mark.asyncio
async def test_service_requests_repository_with_its_site() -> None:
    repository = FakeContentRepository([create_case_entry(site=SiteScope.FALCAO)])
    service = PublicContentService(repository, site=SiteScope.FALCAO)

    cases = await service.list_cases()

    assert repository.requested_site is SiteScope.FALCAO
    assert len(cases) == 1


@pytest.mark.asyncio
async def test_cache_keys_isolate_cases_sharing_a_store() -> None:
    cache = PublicCacheStore(max_entries=10)
    service = PublicContentService(
        FakeContentRepository(
            [
                create_case_entry(
                    site=SiteScope.FALCAO,
                    slug="guia-1",
                    entry_id="id-1",
                    topic="Direito Criminal",
                ),
                create_case_entry(
                    site=SiteScope.FALCAO,
                    slug="guia-2",
                    entry_id="id-2",
                    topic="Execução Penal",
                ),
            ]
        ),
        cache,
        site=SiteScope.FALCAO,
    )

    case_1 = await service.get_case_by_slug("guia-1")
    case_2 = await service.get_case_by_slug("guia-2")

    assert case_1 is not None
    assert case_2 is not None
    assert case_1.topic == "Direito Criminal"
    assert case_2.topic == "Execução Penal"


class FakeFailingTestimonialRepository:
    """Repositorio que falha ao listar depoimentos."""

    async def list_by_site(self, site: SiteScope, only_active: bool = False):
        raise RuntimeError("Banco de depoimentos indisponivel")


@pytest.mark.asyncio
async def test_list_testimonials_fallback_on_repository_failure() -> None:
    """Se o repositorio de depoimentos falha, list_testimonials devolve lista vazia."""
    cache = PublicCacheStore(max_entries=10)
    service = PublicContentService(
        FakeContentRepository([]),
        cache_store=cache,
        testimonial_repository=FakeFailingTestimonialRepository(),
        site=SiteScope.FALCAO,
    )

    testimonials = await service.list_testimonials()

    assert testimonials == []
