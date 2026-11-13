import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.entities.site import SiteScope
from app.domain.repositories.content_repository import ContentRepository
from app.domain.schemas.catalog import calcular_oferta
from app.domain.schemas.content import (
    PublicArticleCardResponse,
    PublicArticleDetailResponse,
    PublicCaseCardResponse,
    PublicCaseDetailResponse,
)
from app.domain.schemas.guide import (
    GuideProdutoResponse,
    PublicGuideCardResponse,
    PublicGuideDetailResponse,
)
from app.domain.schemas.testimonial import PublicTestimonialResponse
from app.infrastructure.cache.public_cache import PublicCacheStore

T = TypeVar("T")

logger = logging.getLogger(__name__)


class PublicContentService:
    def __init__(
        self,
        content_repository: ContentRepository,
        cache_store: PublicCacheStore | None = None,
        data_ttl_seconds: int = 300,
        data_stale_seconds: int = 3600,
        site: SiteScope = SiteScope.FALCAO,
        testimonial_repository=None,
    ):
        self.content_repository = content_repository
        self.cache_store = cache_store
        self.data_ttl_seconds = data_ttl_seconds
        self.data_stale_seconds = data_stale_seconds
        self.site = site
        self.testimonial_repository = testimonial_repository
        self.last_cache_status = "BYPASS"
        self.last_cache_etag = ""

    @staticmethod
    def _media(url: str) -> str:
        return url

    async def list_articles(self, categoria: str | None = None) -> list[PublicArticleCardResponse]:
        return await self._get_or_create(
            key=f"data:{self.site}:articles:list:{categoria or 'all'}",
            tags={"articles", "home", "sitemap"},
            loader=lambda: self._load_articles(categoria),
        )

    async def _load_articles(self, categoria: str | None = None) -> list[PublicArticleCardResponse]:
        entries = await self.content_repository.list_by_status(
            content_type=ContentType.ARTICLE,
            status=ContentStatus.PUBLISHED,
            site=self.site,
        )
        filtered = []
        for entry in entries:
            if not entry.article_detail:
                continue
            cat = getattr(entry.article_detail, "categoria", "geral") or "geral"
            if categoria and cat != categoria:
                continue
            filtered.append(self._to_article_card(entry))
        return filtered

    async def list_guides(self, publico: str | None = None) -> list[PublicGuideCardResponse]:
        return await self._get_or_create(
            key=f"data:{self.site}:guides:list:{publico or 'all'}",
            tags={"guides", "home", "sitemap"},
            loader=lambda: self._load_guides(publico),
        )

    async def _load_guides(self, publico: str | None = None) -> list[PublicGuideCardResponse]:
        entries = await self.content_repository.list_by_status(
            content_type=ContentType.GUIDE,
            status=ContentStatus.PUBLISHED,
            site=self.site,
        )
        if not entries:
            # Fallback para cases antigos
            entries = await self.content_repository.list_by_status(
                content_type=ContentType.CASE,
                status=ContentStatus.PUBLISHED,
                site=self.site,
            )

        filtered = []
        for entry in entries:
            if not entry.guide_detail:
                continue
            guide_pub = str(entry.guide_detail.publico)
            if publico and guide_pub not in ("ambos", publico):
                continue
            filtered.append(self._to_guide_card(entry))
        return filtered

    async def get_guide_by_slug(self, slug: str) -> PublicGuideDetailResponse | None:
        return await self._get_or_create(
            key=f"data:{self.site}:guide:{slug}",
            tags={"guides", f"guide:{slug}", "sitemap"},
            loader=lambda: self._load_guide_by_slug(slug),
        )

    async def _load_guide_by_slug(self, slug: str) -> PublicGuideDetailResponse | None:
        entry = await self.content_repository.find_published_by_slug(
            ContentType.GUIDE, slug, self.site
        )
        if not entry:
            entry = await self.content_repository.find_published_by_slug(
                ContentType.CASE, slug, self.site
            )
        if not entry or not entry.guide_detail:
            return None

        produtos_resp: list[GuideProdutoResponse] = []
        for gp in sorted(entry.guide_produtos, key=lambda x: x.ordem):
            p = gp.produto
            nome = p.nome if p else "Produto"
            p_slug = p.slug if p else ""
            if p:
                promo_ativa, _, preco_atual_val = calcular_oferta(
                    preco_de=p.preco_de,
                    preco_por=p.preco_por,
                    promo_inicio=p.promo_inicio,
                    promo_fim=p.promo_fim,
                )
                preco_de = f"{p.preco_de:.2f}"
                preco_por = f"{p.preco_por:.2f}" if (promo_ativa and p.preco_por) else None
                preco_atual = f"{preco_atual_val:.2f}"
                is_active = p.is_active
            else:
                preco_de = "0.00"
                preco_por = None
                preco_atual = "0.00"
                is_active = False

            produtos_resp.append(
                GuideProdutoResponse(
                    id=gp.id,
                    produto_id=gp.produto_id,
                    nome=nome,
                    slug=p_slug,
                    quantidade=gp.quantidade,
                    ordem=gp.ordem,
                    preco_atual=preco_atual,
                    preco_de=preco_de,
                    preco_por=preco_por,
                    is_active=is_active,
                    imagem_url=p.imagem_url if p else None,
                    forma=p.forma if p else None,
                    cor=p.cor if p else None,
                    tamanho=p.tamanho if p else None,
                )
            )

        card = self._to_guide_card(entry)
        return PublicGuideDetailResponse(
            **card.model_dump(),
            body_markdown=entry.body_markdown or "",
            seo_title=entry.seo_title or entry.title,
            seo_description=entry.seo_description or entry.excerpt or "",
            author=self._safe_author(
                entry.published_author_name,
                entry.published_by or entry.updated_by or entry.created_by,
            ),
            published_at=entry.published_at,
            updated_at=entry.updated_at,
            produtos=produtos_resp,
        )

    def _to_guide_card(self, entry: ContentEntry) -> PublicGuideCardResponse:
        detail = entry.guide_detail
        if not detail:
            raise ValueError("Guide detail is required for guide response.")

        cover_url = None
        if entry.cover_asset:
            cover_url = self._media(entry.cover_asset.public_url)

        return PublicGuideCardResponse(
            id=entry.id,
            title=entry.title,
            slug=entry.slug,
            publico=str(detail.publico),
            tempo_minutos=detail.tempo_minutos,
            tempo_display=f"{detail.tempo_minutos} min",
            etiqueta=detail.etiqueta or "",
            icone=detail.icone or "sparkle",
            dificuldade=detail.dificuldade or "Fácil",
            excerpt=entry.excerpt or "",
            cover_url=cover_url,
            first_published_at=entry.first_published_at,
        )

    async def get_article_by_slug(self, slug: str) -> PublicArticleDetailResponse | None:
        return await self._get_or_create(
            key=f"data:{self.site}:article:{slug}",
            tags={"articles", f"article:{slug}", "sitemap"},
            loader=lambda: self._load_article_by_slug(slug),
        )

    async def _load_article_by_slug(self, slug: str) -> PublicArticleDetailResponse | None:
        entry = await self.content_repository.find_published_by_slug(
            ContentType.ARTICLE, slug, self.site
        )
        if not entry or not entry.article_detail:
            return None

        return PublicArticleDetailResponse(
            **self._to_article_card(entry).model_dump(),
            excerpt=entry.excerpt or "",
            body_markdown=entry.body_markdown,
            seo_title=entry.seo_title or "",
            seo_description=entry.seo_description or "",
            author=self._safe_author(
                entry.published_author_name,
                entry.published_by or entry.updated_by or entry.created_by,
            ),
            author_image_url=entry.published_author_image_url,
            published_at=entry.published_at,
            updated_at=entry.updated_at,
        )

    async def list_cases(self) -> list[PublicCaseCardResponse]:
        return await self._get_or_create(
            key=f"data:{self.site}:cases:list",
            tags={"cases", "home", "sitemap"},
            loader=self._load_cases,
        )

    async def _load_cases(self) -> list[PublicCaseCardResponse]:
        entries = await self.content_repository.list_by_status(
            content_type=ContentType.CASE,
            status=ContentStatus.PUBLISHED,
            site=self.site,
        )
        return [self._to_case_card(entry) for entry in entries if entry.case_detail]

    async def list_testimonials(self) -> list[PublicTestimonialResponse]:
        if self.testimonial_repository is None:
            return []
        try:
            return await self._get_or_create(
                key=f"data:{self.site}:testimonials:list",
                tags={"testimonials", "home"},
                loader=self._load_testimonials,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Falha ao carregar depoimentos para %s", self.site)
            return []

    async def _load_testimonials(self) -> list[PublicTestimonialResponse]:
        entries = await self.testimonial_repository.list_by_site(self.site, only_active=True)
        return [
            PublicTestimonialResponse(
                id=entry.id,
                author=entry.author,
                role=entry.role,
                company=entry.company,
                quote=entry.quote,
                youtube_id=entry.youtube_id,
                avatar_url=self._media(entry.avatar_url),
            )
            for entry in entries
        ]

    async def get_case_by_slug(self, slug: str) -> PublicCaseDetailResponse | None:
        return await self._get_or_create(
            key=f"data:{self.site}:case:{slug}",
            tags={"cases", f"case:{slug}", "sitemap"},
            loader=lambda: self._load_case_by_slug(slug),
        )

    async def _load_case_by_slug(self, slug: str) -> PublicCaseDetailResponse | None:
        entry = await self.content_repository.find_published_by_slug(
            ContentType.CASE, slug, self.site
        )
        if not entry or not entry.case_detail:
            return None

        return PublicCaseDetailResponse(
            **self._to_case_card(entry).model_dump(),
            excerpt=entry.excerpt or "",
            body_markdown=entry.body_markdown,
            seo_title=entry.seo_title or "",
            seo_description=entry.seo_description or "",
            author=self._safe_author(
                entry.published_author_name,
                entry.published_by or entry.updated_by or entry.created_by,
            ),
            published_at=entry.published_at,
            updated_at=entry.updated_at,
        )

    def _to_article_card(self, entry: ContentEntry) -> PublicArticleCardResponse:
        article_detail = entry.article_detail
        if not article_detail:
            raise ValueError("Article detail is required for article response.")

        return PublicArticleCardResponse(
            id=entry.id,
            categoria=getattr(article_detail, "categoria", "geral") or "geral",
            area=article_detail.area,
            reading_time=article_detail.reading_time,
            title=entry.title,
            thumbnail=self._media(article_detail.thumbnail_asset.public_url)
            if article_detail.thumbnail_asset
            else "",
            thumbnail_alt=article_detail.thumbnail_asset.alt_text or entry.title
            if article_detail.thumbnail_asset
            else entry.title,
            thumbnail_position_x=article_detail.thumbnail_position_x
            if article_detail.thumbnail_position_x is not None
            else 50,
            thumbnail_position_y=article_detail.thumbnail_position_y
            if article_detail.thumbnail_position_y is not None
            else 50,
            thumbnail_zoom=article_detail.thumbnail_zoom
            if article_detail.thumbnail_zoom is not None
            else 100,
            href=f"/artigos/{entry.slug}",
            slug=entry.slug,
            first_published_at=entry.first_published_at,
        )

    def _to_case_card(self, entry: ContentEntry) -> PublicCaseCardResponse:
        case_detail = entry.case_detail
        if not case_detail:
            raise ValueError("Case detail is required for case response.")

        return PublicCaseCardResponse(
            id=entry.id,
            topic=case_detail.topic,
            title=entry.title,
            tags=[tag.label for tag in entry.case_tags],
            screenshot=(
                self._media(case_detail.screenshot_asset.public_url)
                if case_detail.screenshot_asset
                else ""
            ),
            screenshot_alt=case_detail.screenshot_asset.alt_text or entry.title
            if case_detail.screenshot_asset
            else entry.title,
            screenshot_position_x=case_detail.screenshot_position_x
            if case_detail.screenshot_position_x is not None
            else 50,
            screenshot_position_y=case_detail.screenshot_position_y
            if case_detail.screenshot_position_y is not None
            else 50,
            screenshot_zoom=case_detail.screenshot_zoom
            if case_detail.screenshot_zoom is not None
            else 100,
            slug=entry.slug,
            first_published_at=entry.first_published_at,
        )

    @classmethod
    def _safe_author(cls, name: str | None, identifier: str | None) -> str:
        if name and "@" not in name:
            return name
        if identifier:
            return cls._format_author(identifier)
        return "Falcão Limpeza"

    @staticmethod
    def _format_author(author_identifier: str) -> str:
        author = author_identifier.strip()
        if not author:
            return "Falcão Limpeza"

        name_part = author.split("@", 1)[0]
        name_part = name_part.replace(".", " ").replace("_", " ").replace("-", " ")
        formatted_name = " ".join(part.capitalize() for part in name_part.split() if part)
        return formatted_name or "Falcão Limpeza"

    async def _get_or_create(
        self,
        key: str,
        tags: set[str],
        loader: Callable[[], Awaitable[T]],
    ) -> T:
        if not self.cache_store:
            self.last_cache_status = "BYPASS"
            self.last_cache_etag = ""
            return await loader()

        cached_result = await self.cache_store.get(key)
        if cached_result.entry:
            self.last_cache_status = cached_result.status
            self.last_cache_etag = cached_result.etag
            return cached_result.value

        lock = await self.cache_store.get_lock(key)
        async with lock:
            cached_result = await self.cache_store.get(key)
            if cached_result.entry:
                self.last_cache_status = cached_result.status
                self.last_cache_etag = cached_result.etag
                return cached_result.value

            value = await loader()
            if value is not None:
                entry = await self.cache_store.set(
                    key=key,
                    value=value,
                    ttl_seconds=self.data_ttl_seconds,
                    stale_seconds=self.data_stale_seconds,
                    tags=tags,
                )
                self.last_cache_etag = entry.etag

            self.last_cache_status = "MISS"
            return value
