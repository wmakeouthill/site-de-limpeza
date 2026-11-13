import pytest

from app.application.services.public_content_service import PublicContentService
from app.domain.entities.site import SiteScope
from app.domain.entities.testimonial import Testimonial, generate_id


class FakeContentRepository:
    async def list_by_status(self, **kwargs):
        return []


class FakeTestimonialRepository:
    def __init__(self, items: list[Testimonial]) -> None:
        self.items = items
        self.calls: list[tuple[str, bool]] = []

    async def list_by_site(self, site: str, only_active: bool = False) -> list[Testimonial]:
        self.calls.append((site, only_active))
        found = [item for item in self.items if item.site == site]
        if only_active:
            found = [item for item in found if item.is_active]
        return sorted(found, key=lambda item: item.sort_order)


def _testimonial(**overrides) -> Testimonial:
    data = {
        "id": generate_id(),
        "site": "falcao",
        "author": "Eduardo Loyola",
        "role": "",
        "company": "WLM",
        "quote": "Time excelente.",
        "youtube_id": "",
        "avatar_url": "",
        "sort_order": 0,
        "is_active": True,
    }
    data.update(overrides)
    return Testimonial(**data)


@pytest.mark.asyncio
async def test_lista_apenas_depoimentos_ativos_do_site() -> None:
    repository = FakeTestimonialRepository(
        [
            _testimonial(author="Ativo", sort_order=0),
            _testimonial(author="Inativo", sort_order=1, is_active=False),
        ]
    )
    service = PublicContentService(
        FakeContentRepository(), site=SiteScope.FALCAO, testimonial_repository=repository
    )

    result = await service.list_testimonials()

    assert [item.author for item in result] == ["Ativo"]
    assert repository.calls == [("falcao", True)]


@pytest.mark.asyncio
async def test_sem_repositorio_de_depoimentos_devolve_lista_vazia() -> None:
    service = PublicContentService(FakeContentRepository(), site=SiteScope.FALCAO)

    assert await service.list_testimonials() == []
