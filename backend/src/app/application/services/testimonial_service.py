from app.domain.entities.site import SiteScope
from app.domain.entities.testimonial import Testimonial, generate_id
from app.domain.schemas.testimonial import (
    TestimonialReorderRequest,
    TestimonialResponse,
    TestimonialUpsert,
)
from app.infrastructure.cache.public_cache import PublicCacheStore
from app.infrastructure.repositories.testimonial_repository import (
    SqlAlchemyTestimonialRepository,
)

CACHE_TAGS = {"home", "testimonials"}


class TestimonialService:
    """Gestao dos depoimentos pelo CMS."""

    __test__ = False

    def __init__(
        self,
        repository: SqlAlchemyTestimonialRepository,
        cache_store: PublicCacheStore | None = None,
    ) -> None:
        self._repository = repository
        self._cache_store = cache_store

    async def list_by_site(self, site: str) -> list[TestimonialResponse]:
        return [_response(item) for item in await self._repository.list_by_site(site)]

    async def create(self, payload: TestimonialUpsert, author_email: str) -> TestimonialResponse:
        existing = await self._repository.list_by_site(payload.site)
        testimonial = Testimonial(
            id=generate_id(),
            site=SiteScope(payload.site),
            author=payload.author,
            role=payload.role,
            company=payload.company,
            quote=payload.quote,
            youtube_id=payload.youtube_id,
            avatar_url=payload.avatar_url,
            is_active=payload.is_active,
            sort_order=max((item.sort_order for item in existing), default=-1) + 1,
            created_by=author_email,
            updated_by=author_email,
        )
        saved = await self._repository.save(testimonial)
        await self._invalidate()
        return _response(saved)

    async def update(
        self,
        testimonial_id: str,
        payload: TestimonialUpsert,
        author_email: str,
    ) -> TestimonialResponse | None:
        testimonial = await self._repository.find_by_id(testimonial_id)
        if testimonial is None:
            return None

        testimonial.site = SiteScope(payload.site)
        testimonial.author = payload.author
        testimonial.role = payload.role
        testimonial.company = payload.company
        testimonial.quote = payload.quote
        testimonial.youtube_id = payload.youtube_id
        testimonial.avatar_url = payload.avatar_url
        testimonial.is_active = payload.is_active
        testimonial.updated_by = author_email

        saved = await self._repository.save(testimonial)
        await self._invalidate()
        return _response(saved)

    async def delete(self, testimonial_id: str) -> bool:
        removed = await self._repository.delete(testimonial_id)
        if removed:
            await self._invalidate()
        return removed

    async def reorder(self, payload: TestimonialReorderRequest) -> bool:
        reordered = await self._repository.reorder(payload.site, payload.ids)
        if reordered:
            await self._invalidate()
        return reordered

    async def _invalidate(self) -> None:
        if self._cache_store:
            await self._cache_store.invalidate_tags(CACHE_TAGS)


def _response(testimonial: Testimonial) -> TestimonialResponse:
    return TestimonialResponse(
        id=testimonial.id,
        site=testimonial.site,
        author=testimonial.author,
        role=testimonial.role,
        company=testimonial.company,
        quote=testimonial.quote,
        youtube_id=testimonial.youtube_id,
        avatar_url=testimonial.avatar_url,
        sort_order=testimonial.sort_order,
        is_active=testimonial.is_active,
        updated_at=testimonial.updated_at,
    )
