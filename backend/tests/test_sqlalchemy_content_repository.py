from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.domain.entities.content import (
    CaseDetail,
    ContentEntry,
    ContentStatus,
    ContentType,
    utc_now,
)
from app.domain.entities.site import SiteScope
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.content_repository import SqlAlchemyContentRepository


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db_session:
        yield db_session
    await engine.dispose()


def _case(site: SiteScope, slug: str) -> ContentEntry:
    entry = ContentEntry(
        content_type=ContentType.CASE,
        status=ContentStatus.PUBLISHED,
        site=site,
        slug=slug,
        title=f"Case {slug}",
        body_markdown="corpo",
        created_by="t@a.com",
        updated_by="t@a.com",
        updated_at=utc_now(),
    )
    entry.case_detail = CaseDetail(topic="Direito Criminal")
    return entry


@pytest.mark.asyncio
async def test_list_by_status_filters_by_site(session: AsyncSession) -> None:
    repository = SqlAlchemyContentRepository(session)
    await repository.save(_case(SiteScope.FALCAO, "guia-1"))

    falcao_list = await repository.list_by_status(
        ContentType.CASE, ContentStatus.PUBLISHED, SiteScope.FALCAO
    )

    assert {entry.slug for entry in falcao_list} == {"guia-1"}


@pytest.mark.asyncio
async def test_find_published_by_slug_is_scoped_by_site(session: AsyncSession) -> None:
    repository = SqlAlchemyContentRepository(session)
    await repository.save(_case(SiteScope.FALCAO, "shared"))

    assert (
        await repository.find_published_by_slug(
            ContentType.CASE, "shared", SiteScope.FALCAO
        )
        is not None
    )
    assert (
        await repository.find_published_by_slug(
            ContentType.CASE, "inexistente", SiteScope.FALCAO
        )
        is None
    )


@pytest.mark.asyncio
async def test_duplicate_slug_same_site_is_blocked(session: AsyncSession) -> None:
    repository = SqlAlchemyContentRepository(session)
    await repository.save(_case(SiteScope.FALCAO, "same"))
    with pytest.raises(IntegrityError):
        await repository.save(_case(SiteScope.FALCAO, "same"))
