from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.infrastructure.config.settings import get_settings

settings = get_settings()


def _create_engine(url: str) -> AsyncEngine:
    if url.startswith("sqlite"):
        return create_async_engine(url, pool_pre_ping=True)
    return create_async_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=1800,
    )


engine = _create_engine(settings.database_url)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

if settings.analytics_database_url:
    analytics_engine = _create_engine(settings.analytics_database_url)
    AnalyticsSessionLocal = async_sessionmaker(
        bind=analytics_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
else:
    analytics_engine = engine
    AnalyticsSessionLocal = AsyncSessionLocal


async def ensure_analytics_schema() -> None:
    from pathlib import Path

    from sqlalchemy import inspect, text

    from app.domain.entities.campaign_source_link import CampaignSourceLink
    from app.domain.entities.site_event import DailyAnalyticsRollup, SiteEvent
    from app.infrastructure.database.base import Base

    if analytics_engine.url.drivername.startswith("sqlite"):
        database_file = analytics_engine.url.database
        if database_file and database_file != ":memory:":
            Path(database_file).parent.mkdir(parents=True, exist_ok=True)

    async with analytics_engine.begin() as connection:
        await connection.run_sync(
            lambda conn: Base.metadata.create_all(
                conn,
                tables=[
                    SiteEvent.__table__,
                    CampaignSourceLink.__table__,
                    DailyAnalyticsRollup.__table__,
                ],
            )
        )
        existing_cols = await connection.run_sync(
            lambda conn: {column["name"] for column in inspect(conn).get_columns("site_events")}
        )
        column_defs = {
            "attribution_id": "VARCHAR(64) NOT NULL DEFAULT ''",
            "utm_term": "VARCHAR(80) NOT NULL DEFAULT ''",
            "utm_content": "VARCHAR(80) NOT NULL DEFAULT ''",
            "placement": "VARCHAR(80) NOT NULL DEFAULT ''",
            "first_touch": "JSON",
            "last_touch": "JSON",
            "occurred_at": "DATETIME",
        }
        for col_name, col_type in column_defs.items():
            if col_name not in existing_cols:
                await connection.execute(
                    text(f"ALTER TABLE site_events ADD COLUMN {col_name} {col_type}")
                )


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


get_session = get_db_session
