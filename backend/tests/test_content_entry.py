from datetime import UTC, datetime

import pytest

from app.domain.entities.content import ContentEntry, ContentStatus, ContentType
from app.domain.exceptions.content import InvalidContentPublicationError


def create_article_entry(**overrides) -> ContentEntry:
    values = {
        "content_type": ContentType.ARTICLE,
        "status": ContentStatus.DRAFT,
        "slug": "agentes-ia",
        "title": "Agentes de IA",
        "body_markdown": "Conteudo do artigo.",
        "created_by": "editor@example.com",
        "updated_by": "editor@example.com",
    }
    values.update(overrides)
    return ContentEntry(**values)


def test_publish_valid_draft_sets_publication_metadata() -> None:
    content_entry = create_article_entry()
    published_at = datetime(2026, 6, 3, 12, 0, tzinfo=UTC)

    content_entry.publish("publisher@example.com", published_at=published_at)

    assert content_entry.status == ContentStatus.PUBLISHED
    assert content_entry.published_by == "publisher@example.com"
    assert content_entry.published_at == published_at
    assert content_entry.updated_by == "publisher@example.com"


def test_publish_requires_slug_title_and_body() -> None:
    content_entry = create_article_entry(slug=" ", body_markdown="")

    with pytest.raises(InvalidContentPublicationError) as error:
        content_entry.publish("publisher@example.com")

    assert "slug" in str(error.value)
    assert "body_markdown" in str(error.value)


def test_unpublish_returns_published_content_to_draft() -> None:
    content_entry = create_article_entry()
    content_entry.publish("publisher@example.com", "Publisher")

    content_entry.unpublish("editor@example.com")

    assert content_entry.status == ContentStatus.DRAFT
    # Email/autor declarado permanecem para republicacao.
    assert content_entry.published_by == "publisher@example.com"
    assert content_entry.published_author_name == "Publisher"
    assert content_entry.published_at is None
    assert content_entry.updated_by == "editor@example.com"


def test_archived_content_cannot_be_published() -> None:
    content_entry = create_article_entry()
    content_entry.archive("editor@example.com")

    with pytest.raises(InvalidContentPublicationError):
        content_entry.publish("publisher@example.com")
