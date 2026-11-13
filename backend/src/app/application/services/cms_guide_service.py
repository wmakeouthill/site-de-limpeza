
from app.domain.entities.content import (
    ContentEntry,
    ContentStatus,
    ContentType,
    generate_id,
    utc_now,
)
from app.domain.entities.guide import GuideDetail, GuideProduto
from app.domain.exceptions.content import ContentNotFoundError
from app.domain.repositories.content_repository import ContentRepository
from app.domain.schemas.catalog import calcular_oferta
from app.domain.schemas.guide import (
    CmsGuideResponse,
    GuideCreate,
    GuideDetailInput,
    GuideProdutoInput,
    GuideProdutoResponse,
    GuideUpdate,
)
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.indexnow import IndexNowClient
from app.infrastructure.security.cms_session import CmsUser


class CmsGuideService:
    def __init__(
        self,
        content_repository: ContentRepository,
        cache_store: PublicCacheStore | None = None,
        indexnow: IndexNowClient | None = None,
    ):
        self.content_repository = content_repository
        self.cache_store = cache_store
        self.indexnow = indexnow

    async def create_guide(self, payload: GuideCreate, user: CmsUser) -> CmsGuideResponse:
        author_name, author_image_url, author_email = self._resolve_author_for_create(payload, user)
        content_entry = ContentEntry(
            id=generate_id(),
            content_type=ContentType.GUIDE,
            site=payload.site,
            status=ContentStatus.DRAFT,
            slug=payload.slug,
            title=payload.title,
            excerpt=payload.excerpt,
            body_markdown=payload.body_markdown,
            seo_title=payload.seo_title or payload.title,
            seo_description=payload.seo_description or payload.excerpt,
            created_by=user.email,
            updated_by=user.email,
            published_by=author_email,
            published_author_name=author_name,
            published_author_image_url=author_image_url or None,
            cover_asset_id=payload.cover_asset_id,
        )
        content_entry.guide_detail = self._build_guide_detail(payload.guide_detail)
        self._sync_guide_produtos(content_entry, payload.produtos)

        saved_entry = await self.content_repository.save(content_entry)
        return self._to_guide_response(saved_entry)

    async def get_guide(self, guide_id: str) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        return self._to_guide_response(content_entry)

    async def update_guide(
        self,
        guide_id: str,
        payload: GuideUpdate,
        user: CmsUser,
    ) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED

        content_entry.slug = payload.slug
        content_entry.title = payload.title
        content_entry.excerpt = payload.excerpt
        content_entry.body_markdown = payload.body_markdown
        content_entry.seo_title = payload.seo_title or payload.title
        content_entry.seo_description = payload.seo_description or payload.excerpt
        content_entry.cover_asset_id = payload.cover_asset_id
        content_entry.updated_by = user.email

        self._apply_author_from_payload(content_entry, payload)

        if not content_entry.guide_detail:
            content_entry.guide_detail = self._build_guide_detail(payload.guide_detail)
        else:
            self._update_guide_detail(content_entry.guide_detail, payload.guide_detail)

        self._sync_guide_produtos(content_entry, payload.produtos)

        saved_entry = await self.content_repository.save(content_entry)
        if was_published or saved_entry.status == ContentStatus.PUBLISHED:
            await self._invalidate_public_cache(old_slug, saved_entry.slug)
        return self._to_guide_response(saved_entry)

    async def publish_guide(self, guide_id: str, user: CmsUser) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        author_name = (content_entry.published_author_name or "").strip()
        if author_name:
            author_image_url = content_entry.published_author_image_url or ""
            published_by = content_entry.published_by or user.email
        else:
            author_name = user.name
            author_image_url = user.photo_url or ""
            published_by = user.email

        content_entry.publish(published_by, author_name, author_image_url)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(saved_entry.slug)
        return self._to_guide_response(saved_entry)

    async def unpublish_guide(self, guide_id: str, user: CmsUser) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        content_entry.unpublish(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(saved_entry.slug)
        return self._to_guide_response(saved_entry)

    async def archive_guide(self, guide_id: str, user: CmsUser) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        content_entry.archive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        await self._invalidate_public_cache(saved_entry.slug)
        return self._to_guide_response(saved_entry)

    async def unarchive_guide(self, guide_id: str, user: CmsUser) -> CmsGuideResponse:
        content_entry = await self._get_guide_entry(guide_id)
        content_entry.unarchive(user.email)
        saved_entry = await self.content_repository.save(content_entry)
        return self._to_guide_response(saved_entry)

    async def delete_guide(self, guide_id: str) -> None:
        content_entry = await self._get_guide_entry(guide_id)
        old_slug = content_entry.slug
        was_published = content_entry.status == ContentStatus.PUBLISHED
        await self.content_repository.delete(content_entry)
        if was_published:
            await self._invalidate_public_cache(old_slug)

    async def _get_guide_entry(self, guide_id: str) -> ContentEntry:
        content_entry = await self.content_repository.find_by_id(guide_id)
        if not content_entry or content_entry.content_type not in (ContentType.GUIDE, ContentType.CASE):
            raise ContentNotFoundError("Guia nao encontrado.")
        return content_entry

    def _build_guide_detail(self, payload: GuideDetailInput) -> GuideDetail:
        return GuideDetail(
            publico=payload.publico,
            tempo_minutos=payload.tempo_minutos,
            etiqueta=payload.etiqueta,
            icone=payload.icone,
            dificuldade=payload.dificuldade,
        )

    def _update_guide_detail(self, detail: GuideDetail, payload: GuideDetailInput) -> None:
        detail.publico = payload.publico
        detail.tempo_minutos = payload.tempo_minutos
        detail.etiqueta = payload.etiqueta
        detail.icone = payload.icone
        detail.dificuldade = payload.dificuldade

    def _sync_guide_produtos(self, content_entry: ContentEntry, produtos_input: list[GuideProdutoInput]) -> None:
        content_entry.guide_produtos.clear()
        for idx, item in enumerate(produtos_input):
            content_entry.guide_produtos.append(
                GuideProduto(
                    id=generate_id(),
                    guide_id=content_entry.id,
                    produto_id=item.produto_id,
                    quantidade=item.quantidade,
                    ordem=item.ordem if item.ordem is not None else idx,
                )
            )

    @staticmethod
    def _resolve_author_for_create(payload: GuideCreate, user: CmsUser) -> tuple[str, str, str]:
        author_name = payload.author_name.strip()
        if author_name:
            return author_name, payload.author_image_url.strip(), payload.author_email or user.email
        return user.name, user.photo_url or "", user.email

    @staticmethod
    def _apply_author_from_payload(content_entry: ContentEntry, payload: GuideUpdate) -> None:
        if payload.author_name:
            content_entry.published_author_name = payload.author_name.strip()
        if payload.author_image_url is not None:
            content_entry.published_author_image_url = payload.author_image_url.strip() or None
        if payload.author_email:
            content_entry.published_by = payload.author_email.strip()

    async def _invalidate_public_cache(self, old_slug: str, new_slug: str | None = None) -> None:
        tags = {"home", "guides", "sitemap", f"guide:{old_slug}"}
        if new_slug and new_slug != old_slug:
            tags.add(f"guide:{new_slug}")
        if self.cache_store:
            await self.cache_store.invalidate_tags(tags)
        if self.indexnow:
            slugs = (slug for slug in (old_slug, new_slug) if slug)
            await self.indexnow.submit_paths(
                ["/", "/guias", *(f"/guias/{slug}" for slug in slugs)]
            )

    @staticmethod
    def _to_guide_response(content_entry: ContentEntry) -> CmsGuideResponse:
        detail = content_entry.guide_detail
        if not detail:
            raise ContentNotFoundError("Detalhes do guia nao encontrados.")

        produtos_resp: list[GuideProdutoResponse] = []
        for gp in sorted(content_entry.guide_produtos, key=lambda x: x.ordem):
            p = gp.produto
            nome = p.nome if p else "Produto"
            slug = p.slug if p else ""
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
                    slug=slug,
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

        return CmsGuideResponse(
            id=content_entry.id,
            content_type=content_entry.content_type,
            site=content_entry.site,
            status=content_entry.status,
            slug=content_entry.slug,
            title=content_entry.title,
            excerpt=content_entry.excerpt or "",
            body_markdown=content_entry.body_markdown,
            cover_asset_id=content_entry.cover_asset_id,
            seo_title=content_entry.seo_title or "",
            seo_description=content_entry.seo_description or "",
            published_at=content_entry.published_at,
            updated_at=content_entry.updated_at or utc_now(),
            created_at=content_entry.created_at or utc_now(),
            created_by=content_entry.created_by,
            updated_by=content_entry.updated_by,
            published_by=content_entry.published_by,
            published_author_name=content_entry.published_author_name,
            published_author_image_url=content_entry.published_author_image_url,
            publico=detail.publico,
            tempo_minutos=detail.tempo_minutos,
            etiqueta=detail.etiqueta,
            icone=detail.icone,
            dificuldade=detail.dificuldade,
            produtos=produtos_resp,
        )
