from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.article_like_repository import (
    SqlAlchemyArticleLikeRepository,
)
from app.infrastructure.repositories.content_repository import SqlAlchemyContentRepository


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", poolclass=StaticPool)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as db_session:
        yield db_session
    await engine.dispose()


@pytest.mark.asyncio
async def test_toggle_works_after_content_lookup_started_transaction(
    session: AsyncSession,
) -> None:
    content = SqlAlchemyContentRepository(session)
    article = await content.save(
        ContentEntry(
            content_type=ContentType.ARTICLE,
            status=ContentStatus.PUBLISHED,
            slug="article",
            title="Article",
            body_markdown="Body",
            created_by="editor",
            updated_by="editor",
        )
    )
    await content.find_published_by_slug(ContentType.ARTICLE, article.slug)

    repository = SqlAlchemyArticleLikeRepository(session)
    assert await repository.toggle(article.id, "visitor") == (True, 1)
    assert await repository.toggle(article.id, "visitor") == (False, 0)
