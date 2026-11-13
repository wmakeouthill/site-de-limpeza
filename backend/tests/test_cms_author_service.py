import pytest

from app.application.services.cms_author_service import CmsAuthorService
from app.domain.entities.cms_author import CmsAuthor, utc_now


class FakeCmsAuthorRepository:
    def __init__(self):
        self.authors: dict[str, CmsAuthor] = {}

    async def upsert(self, email: str, name: str, photo_url: str = "") -> CmsAuthor:
        normalized_email = email.strip().lower()
        now = utc_now()
        existing = self.authors.get(normalized_email)
        if existing is None:
            author = CmsAuthor(
                email=normalized_email,
                name=name.strip(),
                photo_url=photo_url or "",
                last_seen_at=now,
                created_at=now,
                updated_at=now,
            )
            self.authors[normalized_email] = author
            return author

        existing.name = name.strip() or existing.name
        if photo_url:
            existing.photo_url = photo_url
        existing.last_seen_at = now
        existing.updated_at = now
        return existing

    async def list_authors(self) -> list[CmsAuthor]:
        return sorted(self.authors.values(), key=lambda author: author.name)


@pytest.mark.asyncio
async def test_upsert_creates_and_updates_author() -> None:
    repository = FakeCmsAuthorRepository()
    service = CmsAuthorService(repository)

    created = await service.upsert("Editor@example.com", "Editor", "/uploads/a.png")
    updated = await service.upsert("editor@example.com", "Editor Atualizado", "/uploads/b.png")

    assert created == {
        "email": "editor@example.com",
        "name": "Editor",
        "photoUrl": "/uploads/a.png",
    }
    assert updated["name"] == "Editor Atualizado"
    assert updated["photoUrl"] == "/uploads/b.png"
    assert len(repository.authors) == 1


@pytest.mark.asyncio
async def test_upsert_keeps_existing_photo_when_empty() -> None:
    repository = FakeCmsAuthorRepository()
    service = CmsAuthorService(repository)

    await service.upsert("ana@example.com", "Ana", "/uploads/ana.png")
    updated = await service.upsert("ana@example.com", "Ana Silva", "")

    assert updated["name"] == "Ana Silva"
    assert updated["photoUrl"] == "/uploads/ana.png"


@pytest.mark.asyncio
async def test_list_authors_returns_sorted_items() -> None:
    repository = FakeCmsAuthorRepository()
    service = CmsAuthorService(repository)

    await service.upsert("b@example.com", "Bruno", "")
    await service.upsert("a@example.com", "Ana", "/photo.png")

    items = await service.list_authors()

    assert items == [
        {"email": "a@example.com", "name": "Ana", "photoUrl": "/photo.png"},
        {"email": "b@example.com", "name": "Bruno", "photoUrl": ""},
    ]
