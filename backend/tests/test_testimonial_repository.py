from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.domain.entities.testimonial import Testimonial
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.testimonial_repository import (
    SqlAlchemyTestimonialRepository,
)


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        yield db
    await engine.dispose()


def _testimonial(**overrides) -> Testimonial:
    data = {
        "site": "falcao",
        "author": "Eduardo Loyola",
        "quote": "Time excelente.",
        "sort_order": 0,
        "is_active": True,
    }
    data.update(overrides)
    return Testimonial(**data)


@pytest.mark.asyncio
async def test_lista_por_site_na_ordem_e_filtra_inativos(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    await repository.save(_testimonial(author="Segundo", sort_order=1))
    await repository.save(_testimonial(author="Primeiro", sort_order=0))
    await repository.save(_testimonial(author="Desativado", sort_order=2, is_active=False))
    await repository.save(_testimonial(author="Do Talimpo", site="talimpo", sort_order=0))

    todos = await repository.list_by_site("falcao")
    ativos = await repository.list_by_site("falcao", only_active=True)

    assert [item.author for item in todos] == ["Primeiro", "Segundo", "Desativado"]
    assert [item.author for item in ativos] == ["Primeiro", "Segundo"]


@pytest.mark.asyncio
async def test_lista_de_um_site_nao_vaza_no_outro(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    await repository.save(_testimonial(author="Do Falcao", site="falcao"))
    await repository.save(_testimonial(author="Do Talimpo", site="talimpo"))

    assert [item.author for item in await repository.list_by_site("talimpo")] == ["Do Talimpo"]


@pytest.mark.asyncio
async def test_reorder_reatribui_a_ordem_de_zero_a_n(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    primeiro = await repository.save(_testimonial(author="A", sort_order=0))
    segundo = await repository.save(_testimonial(author="B", sort_order=1))
    terceiro = await repository.save(_testimonial(author="C", sort_order=2))

    assert await repository.reorder("falcao", [terceiro.id, primeiro.id, segundo.id]) is True

    assert [item.author for item in await repository.list_by_site("falcao")] == ["C", "A", "B"]


@pytest.mark.asyncio
async def test_reorder_rejeita_id_de_outro_site_sem_gravar_nada(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    do_falcao = await repository.save(_testimonial(author="A", sort_order=0))
    do_edu = await repository.save(_testimonial(author="B", site="talimpo", sort_order=0))

    assert await repository.reorder("falcao", [do_edu.id, do_falcao.id]) is False

    assert (await repository.find_by_id(do_falcao.id)).sort_order == 0


@pytest.mark.asyncio
async def test_reorder_rejeita_id_duplicado(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    primeiro = await repository.save(_testimonial(author="A", sort_order=0))
    await repository.save(_testimonial(author="B", sort_order=1))

    assert await repository.reorder("falcao", [primeiro.id, primeiro.id]) is False


@pytest.mark.asyncio
async def test_edita_e_remove_depoimento(session: AsyncSession) -> None:
    repository = SqlAlchemyTestimonialRepository(session)
    saved = await repository.save(_testimonial())

    saved.author = "Outro Autor"
    await repository.save(saved)

    assert (await repository.find_by_id(saved.id)).author == "Outro Autor"
    assert await repository.delete(saved.id) is True
    assert await repository.find_by_id(saved.id) is None
    assert await repository.delete(saved.id) is False
