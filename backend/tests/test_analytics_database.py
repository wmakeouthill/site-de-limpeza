import importlib
from datetime import UTC, datetime

import pytest
from sqlalchemy import inspect, text

from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import SiteEvent, SiteEventType
from app.infrastructure.config.settings import get_settings
from app.infrastructure.repositories.site_event_repository import SqlAlchemySiteEventRepository


@pytest.mark.asyncio
async def test_events_land_in_the_dedicated_analytics_database(tmp_path, monkeypatch) -> None:
    """Prod nao tem Postgres (roda so com o aura) e o alembic nem chega a rodar.

    Com ANALYTICS_DATABASE_URL o evento tem que cair num banco proprio, com a
    tabela criada na subida — foi o que faltava e deixou o dashboard zerado.
    """
    arquivo = tmp_path / "metricas" / "analytics.db"  # o diretorio ainda nao existe
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", f"sqlite+aiosqlite:///{arquivo.as_posix()}")
    get_settings.cache_clear()

    from app.infrastructure.database import session as session_module

    importlib.reload(session_module)
    try:
        assert session_module.analytics_engine is not session_module.engine
        await session_module.ensure_analytics_schema()

        async with session_module.analytics_engine.connect() as connection:
            tables = await connection.run_sync(
                lambda sync_connection: set(inspect(sync_connection).get_table_names())
            )
        assert {"site_events", "campaign_source_links"} <= tables

        async with session_module.AnalyticsSessionLocal() as db:
            gravados = await SqlAlchemySiteEventRepository(db).add_many(
                [
                    SiteEvent(
                        site=SiteScope.FALCAO,
                        session_id="sessao-0001",
                        event=SiteEventType.PAGEVIEW,
                        page="/",
                    )
                ]
            )
            await db.commit()

        assert gravados == 1
        assert arquivo.exists()
    finally:
        await session_module.analytics_engine.dispose()
        monkeypatch.delenv("ANALYTICS_DATABASE_URL")
        get_settings.cache_clear()
        importlib.reload(session_module)


@pytest.mark.asyncio
async def test_existing_analytics_sqlite_gains_occurred_at_column(tmp_path, monkeypatch) -> None:
    """O banco persistente de producao pode existir antes de uma nova coluna."""
    arquivo = tmp_path / "analytics.db"
    monkeypatch.setenv("ANALYTICS_DATABASE_URL", f"sqlite+aiosqlite:///{arquivo.as_posix()}")
    get_settings.cache_clear()

    from app.infrastructure.database import session as session_module

    importlib.reload(session_module)
    try:
        async with session_module.analytics_engine.begin() as connection:
            await connection.execute(
                text(
                    "CREATE TABLE site_events ("
                    "id VARCHAR(36) PRIMARY KEY, site VARCHAR(20) NOT NULL, "
                    "session_id VARCHAR(36) NOT NULL, event VARCHAR(40) NOT NULL, "
                    "target VARCHAR(200) NOT NULL, page VARCHAR(255) NOT NULL, "
                    "referrer VARCHAR(255) NOT NULL, utm_source VARCHAR(120) NOT NULL, "
                    "utm_medium VARCHAR(120) NOT NULL, utm_campaign VARCHAR(120) NOT NULL, "
                    "device VARCHAR(20) NOT NULL, dwell_ms INTEGER NOT NULL, "
                    "pos_x INTEGER NOT NULL, pos_y INTEGER NOT NULL, created_at DATETIME NOT NULL)"
                )
            )

        await session_module.ensure_analytics_schema()
        async with session_module.analytics_engine.connect() as connection:
            columns = await connection.run_sync(
                lambda sync_connection: {
                    column["name"]
                    for column in inspect(sync_connection).get_columns("site_events")
                }
            )
        assert "occurred_at" in columns

        async with session_module.AnalyticsSessionLocal() as database:
            inserted = await SqlAlchemySiteEventRepository(database).add_many(
                [
                    SiteEvent(
                        site=SiteScope.FALCAO,
                        session_id="legacy-session",
                        event=SiteEventType.PAGEVIEW,
                        occurred_at=datetime(2026, 8, 19, tzinfo=UTC),
                    )
                ]
            )
        assert inserted == 1
    finally:
        await session_module.analytics_engine.dispose()
        monkeypatch.delenv("ANALYTICS_DATABASE_URL")
        get_settings.cache_clear()
        importlib.reload(session_module)
