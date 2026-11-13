import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

TestimonialSite = Literal["falcao"]

_YOUTUBE_ID = re.compile(r"\A[A-Za-z0-9_-]{11}\Z")
_YOUTUBE_URL = re.compile(
    r"(?:youtube\.com/(?:watch\?(?:[^ ]*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def normalize_youtube_id(value: str) -> str:
    """Aceita o ID puro ou uma URL colada do navegador; devolve so o ID.

    Entrada que nao casa vira erro em vez de gravar um embed quebrado na home.
    """
    raw = value.strip()
    if not raw:
        return ""
    if _YOUTUBE_ID.match(raw):
        return raw
    match = _YOUTUBE_URL.search(raw)
    if match:
        return match.group(1)
    raise ValueError("Informe o ID ou a URL de um video do YouTube.")


class TestimonialUpsert(BaseModel):
    __test__ = False
    site: TestimonialSite
    author: str = Field(..., min_length=1, max_length=160)
    role: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=160)
    quote: str = Field(..., min_length=1)
    youtube_id: str = Field(default="", max_length=200)
    avatar_url: str = Field(default="", max_length=1000)
    is_active: bool = True

    @field_validator("author", "quote")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Autor e depoimento sao obrigatorios.")
        return text

    @field_validator("role", "company", "avatar_url")
    @classmethod
    def strip_optional_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("youtube_id")
    @classmethod
    def validate_youtube_id(cls, value: str) -> str:
        return normalize_youtube_id(value)


class TestimonialResponse(BaseModel):
    __test__ = False
    id: str
    site: TestimonialSite
    author: str
    role: str
    company: str
    quote: str
    youtube_id: str
    avatar_url: str
    sort_order: int
    is_active: bool
    updated_at: datetime | None = None


class TestimonialReorderRequest(BaseModel):
    __test__ = False
    site: TestimonialSite
    ids: list[str] = Field(..., min_length=1)


class PublicTestimonialResponse(BaseModel):
    """O que vai para o serverData da home."""

    id: str
    author: str
    role: str
    company: str
    quote: str
    youtube_id: str
    avatar_url: str
