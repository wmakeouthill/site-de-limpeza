import pytest

from app.application.services.testimonial_service import TestimonialService
from app.domain.entities.site import SiteScope
from app.domain.entities.testimonial import Testimonial, generate_id
from app.domain.schemas.testimonial import TestimonialReorderRequest, TestimonialUpsert


class FakeTestimonialRepository:
    def __init__(self) -> None:
        self.items: list[Testimonial] = []
        self.reorder_calls: list[tuple[str, list[str]]] = []

    async def list_by_site(self, site: str, only_active: bool = False) -> list[Testimonial]:
        found = [item for item in self.items if item.site == site]
        if only_active:
            found = [item for item in found if item.is_active]
        return sorted(found, key=lambda item: item.sort_order)

    async def find_by_id(self, testimonial_id: str) -> Testimonial | None:
        return next((item for item in self.items if item.id == testimonial_id), None)

    async def save(self, testimonial: Testimonial) -> Testimonial:
        if testimonial not in self.items:
            self.items.append(testimonial)
        return testimonial

    async def delete(self, testimonial_id: str) -> bool:
        found = await self.find_by_id(testimonial_id)
        if found is None:
            return False
        self.items.remove(found)
        return True

    async def reorder(self, site: SiteScope | str, ids: list[str]) -> bool:
        self.reorder_calls.append((site, ids))
        return True


class FakeCacheStore:
    def __init__(self) -> None:
        self.invalidated: list[set[str]] = []

    async def invalidate_tags(self, tags: set[str]) -> None:
        self.invalidated.append(tags)


def _payload(**overrides) -> TestimonialUpsert:
    data = {"site": "falcao", "author": "Eduardo Loyola", "quote": "Time excelente."}
    data.update(overrides)
    return TestimonialUpsert(**data)


@pytest.mark.asyncio
async def test_cria_depoimento_no_fim_da_ordem_e_registra_o_autor() -> None:
    repository = FakeTestimonialRepository()
    repository.items.append(
        Testimonial(id=generate_id(), site="falcao", author="Ja existia", quote="x", sort_order=0)
    )
    service = TestimonialService(repository)

    created = await service.create(_payload(), "editor@falcaolimpeza.com.br")

    assert created.sort_order == 1
    assert created.is_active is True
    assert (await repository.find_by_id(created.id)).created_by == "editor@falcaolimpeza.com.br"


@pytest.mark.asyncio
async def test_cria_depoimento_apos_buraco_na_ordem_sem_colidir() -> None:
    repository = FakeTestimonialRepository()
    for sort_order in (0, 2):
        repository.items.append(
            Testimonial(id=generate_id(), site="falcao", author="X", quote="x", sort_order=sort_order)
        )
    service = TestimonialService(repository)

    created = await service.create(_payload(), "editor@falcaolimpeza.com.br")

    assert created.sort_order == 3


@pytest.mark.asyncio
async def test_criar_invalida_o_cache_da_home() -> None:
    cache_store = FakeCacheStore()
    service = TestimonialService(FakeTestimonialRepository(), cache_store=cache_store)

    await service.create(_payload(), "editor@falcaolimpeza.com.br")

    assert cache_store.invalidated == [{"home", "testimonials"}]


@pytest.mark.asyncio
async def test_edita_depoimento_existente_e_preserva_a_ordem() -> None:
    repository = FakeTestimonialRepository()
    service = TestimonialService(repository)
    created = await service.create(_payload(), "editor@falcaolimpeza.com.br")

    updated = await service.update(
        created.id, _payload(author="Outro Autor"), "revisor@falcaolimpeza.com.br"
    )

    assert updated is not None
    assert updated.author == "Outro Autor"
    assert updated.sort_order == created.sort_order
    assert (await repository.find_by_id(created.id)).updated_by == "revisor@falcaolimpeza.com.br"


@pytest.mark.asyncio
async def test_editar_id_inexistente_devolve_none() -> None:
    service = TestimonialService(FakeTestimonialRepository())

    assert await service.update("nao-existe", _payload(), "editor@falcaolimpeza.com.br") is None


@pytest.mark.asyncio
async def test_reorder_repassa_a_lista_para_o_repositorio() -> None:
    repository = FakeTestimonialRepository()
    service = TestimonialService(repository)

    assert await service.reorder(TestimonialReorderRequest(site="falcao", ids=["b", "a"])) is True
    assert repository.reorder_calls == [("falcao", ["b", "a"])]
