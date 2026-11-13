import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.infrastructure.database.base import Base
from app.infrastructure.database.seeds.catalog_seed import seed_catalog


@pytest.mark.asyncio
async def test_seed_catalogo_idempotente(tmp_path) -> None:
    db_file = tmp_path / "test_seed.db"
    url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        # Primeira execução
        async with session_factory() as session:
            stats = await seed_catalog(session)
            assert stats["departamentos"] == 6
            assert stats["produtos"] == 21
            assert stats["kits"] == 4

        # Verifica dados no banco
        async with session_factory() as session:
            total_depts = (await session.execute(select(func.count(Departamento.id)))).scalar_one()
            total_prods = (await session.execute(select(func.count(Produto.id)))).scalar_one()
            total_kits = (await session.execute(select(func.count(Kit.id)))).scalar_one()
            total_itens = (await session.execute(select(func.count(KitItem.id)))).scalar_one()

            assert total_depts == 6
            assert total_prods == 21
            assert total_kits == 4
            assert total_itens == 24

        # Segunda execução: idempotência (não duplica)
        async with session_factory() as session:
            stats_again = await seed_catalog(session)
            assert stats_again["departamentos"] == 6
            assert stats_again["produtos"] == 21
            assert stats_again["kits"] == 4

        # Verifica que totais permanecem idênticos
        async with session_factory() as session:
            total_depts2 = (await session.execute(select(func.count(Departamento.id)))).scalar_one()
            total_prods2 = (await session.execute(select(func.count(Produto.id)))).scalar_one()
            total_kits2 = (await session.execute(select(func.count(Kit.id)))).scalar_one()
            total_itens2 = (await session.execute(select(func.count(KitItem.id)))).scalar_one()

            assert total_depts2 == 6
            assert total_prods2 == 21
            assert total_kits2 == 4
            assert total_itens2 == 24
    finally:
        await engine.dispose()
