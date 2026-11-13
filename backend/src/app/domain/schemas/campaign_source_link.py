from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator


class CampaignSourceLinkUpsert(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    source_url: str = Field(..., min_length=1, max_length=500)
    thumbnail_url: str = Field(default="", max_length=500)
    redirect_url: str = Field(default="", max_length=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("O titulo e obrigatorio.")
        return title

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        url = value.strip()
        if not url:
            raise ValueError("A URL de origem e obrigatoria.")
        parsed = urlsplit(url)
        if parsed.scheme.lower() in ("javascript", "data", "vbscript", "file"):
            raise ValueError("Esquema de URL perigoso.")
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("A URL deve usar HTTPS.")
        return url

    @field_validator("thumbnail_url", "redirect_url")
    @classmethod
    def validate_optional_urls(cls, value: str) -> str:
        url = value.strip()
        if not url:
            return ""
        parsed = urlsplit(url)
        if parsed.scheme.lower() in ("javascript", "data", "vbscript", "file"):
            raise ValueError("Esquema de URL perigoso.")
        if parsed.scheme != "https" or not parsed.hostname:
            raise ValueError("A URL deve usar HTTPS.")
        return url


class CampaignSourceLinkResponse(CampaignSourceLinkUpsert):
    identifier: str
