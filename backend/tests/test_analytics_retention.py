import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import SiteEvent, SiteEventType
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.site_event_repository import SqlAlchemySiteEventRepository


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
async def test_archive_and_purge_preserva_so_agregado_anonimo_do_dia(session: AsyncSession) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    expired_at = datetime.now(UTC) - timedelta(days=91)
    session.add_all(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-expirada-1",
                attribution_id="atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac",
                event=SiteEventType.PAGEVIEW,
                page="/solucoes",
                utm_source="google",
                utm_medium="organic",
                created_at=expired_at,
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-expirada-1",
                attribution_id="atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac",
                event=SiteEventType.CLICK,
                target="Falar com especialista",
                created_at=expired_at,
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-recente-1",
                event=SiteEventType.PAGEVIEW,
                page="/contato",
                created_at=datetime.now(UTC),
            ),
        ]
    )
    await session.commit()

    removed = await repository.archive_and_purge_older_than(90)
    remaining = list((await session.execute(select(SiteEvent))).scalars())
    rollups = await repository.daily_rollups(site=SiteScope.FALCAO)

    assert removed == 2
    assert [event.session_id for event in remaining] == ["sessao-recente-1"]
    assert rollups[0].payload["overview"] == {
        "visitors": 1,
        "pageviews": 1,
        "clicks": 1,
        "form_submits": 0,
        "engaged_visitors": 1,
    }
    assert rollups[0].payload["sources"] == [{"label": "google", "count": 1}]
    serialized = json.dumps(rollups[0].payload)
    assert "sessao-expirada-1" not in serialized
    assert "atr-7c31f879" not in serialized

