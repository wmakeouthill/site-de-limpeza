from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import StaticPool

from app.domain.entities.testimonial import Testimonial
from app.infrastructure.database.base import Base


@pytest_asyncio.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    yield engine
    await engine.dispose()


@pytest.mark.asyncio
async def test_create_all_cria_a_tabela_de_depoimentos_no_sqlite(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, tables=[Testimonial.__table__])
        tables = await conn.run_sync(
            lambda sync_connection: set(inspect(sync_connection).get_table_names())
        )
        columns = await conn.run_sync(
            lambda sync_connection: {
                column["name"] for column in inspect(sync_connection).get_columns("testimonials")
            }
        )

    assert "testimonials" in tables
    assert columns == {
        "id",
        "site",
        "author",
        "role",
        "company",
        "quote",
        "youtube_id",
        "avatar_url",
        "sort_order",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    }
