from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.campaign_source_link_repository import (
    SqlAlchemyCampaignSourceLinkRepository,
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


@pytest.mark.asyncio
async def test_upsert_lista_e_remove_link_de_campanha_no_sqlite(session: AsyncSession) -> None:
    repository = SqlAlchemyCampaignSourceLinkRepository(session)
    link = CampaignSourceLink(
        identifier="reel-agosto-01",
        title="Reel: agentes de IA",
        source_url="https://www.instagram.com/reel/ABC123/",
        thumbnail_url="https://cdn.example.com/reel-agosto-01.jpg",
    )

    saved = await repository.upsert(link)
    listed = await repository.list_all()

    assert saved.identifier == "reel-agosto-01"
    assert [(item.identifier, item.title) for item in listed] == [
        ("reel-agosto-01", "Reel: agentes de IA")
    ]
    assert await repository.delete("reel-agosto-01") is True
    assert await repository.list_all() == []


@pytest.mark.asyncio
async def test_busca_link_de_campanha_pela_url_curta_de_redirecionamento(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemyCampaignSourceLinkRepository(session)
    await repository.upsert(
        CampaignSourceLink(
            identifier="reel-case-01",
            title="Case Limpeza Industrial",
            source_url="https://www.instagram.com/reel/ABC123/",
            thumbnail_url="",
            redirect_url="https://bit.ly/exemplo",
        )
    )

    found = await repository.find_by_redirect_url("https://bit.ly/exemplo")

    assert found is not None
    assert found.identifier == "reel-case-01"
