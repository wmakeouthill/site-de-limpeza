from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Falcão Limpeza API", alias="APP_NAME")
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        alias="ENVIRONMENT",
    )
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    database_url: str = Field(
        default="postgresql+asyncpg://falcao:falcao@localhost:5433/falcao_limpeza",
        alias="DATABASE_URL",
    )
    cors_origins: str = Field(
        default="http://localhost:4321,http://127.0.0.1:4321,http://localhost:8000",
        alias="CORS_ORIGINS",
    )
    public_site_base_url: str = Field(
        default="http://localhost:4321",
        alias="PUBLIC_SITE_BASE_URL",
    )
    indexnow_key: str = Field(default="", alias="INDEXNOW_KEY")
    cms_frontend_url: str = Field(
        default="http://localhost:4321/cms",
        alias="CMS_FRONTEND_URL",
    )
    cms_upload_dir: str = Field(
        default=".cms-uploads",
        alias="CMS_UPLOAD_DIR",
    )
    azure_storage_connection_string: str = Field(
        default="",
        alias="AZURE_STORAGE_CONNECTION_STRING",
    )
    azure_storage_container: str = Field(
        default="cms-uploads",
        alias="AZURE_STORAGE_CONTAINER",
    )
    cms_session_secret: str = Field(default="", alias="CMS_SESSION_SECRET")
    cms_allowed_emails: str = Field(default="", alias="CMS_ALLOWED_EMAILS")
    cms_access_token_ttl_minutes: int = Field(
        default=15,
        ge=1,
        le=15,
        alias="CMS_ACCESS_TOKEN_TTL_MINUTES",
    )
    cms_refresh_token_ttl_days: int = Field(
        default=30,
        ge=1,
        alias="CMS_REFRESH_TOKEN_TTL_DAYS",
    )
    cms_cookie_secure: bool | None = Field(default=None, alias="CMS_COOKIE_SECURE")
    cms_cookie_domain: str = Field(default="", alias="CMS_COOKIE_DOMAIN")
    public_data_cache_ttl_seconds: int = Field(
        default=300,
        alias="PUBLIC_DATA_CACHE_TTL_SECONDS",
    )
    public_data_cache_stale_seconds: int = Field(
        default=3600,
        alias="PUBLIC_DATA_CACHE_STALE_SECONDS",
    )
    public_testimonials_enabled: bool = Field(
        default=True,
        alias="PUBLIC_TESTIMONIALS_ENABLED",
    )
    analytics_enabled: bool = Field(
        default=True,
        alias="ANALYTICS_ENABLED",
    )
    analytics_database_url: str = Field(
        default="",
        alias="ANALYTICS_DATABASE_URL",
    )
    analytics_retention_days: int = Field(
        default=90,
        ge=1,
        alias="ANALYTICS_RETENTION_DAYS",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.rstrip("/") for origin in self._parse_csv(self.cors_origins)]

    @property
    def cms_allowed_email_list(self) -> list[str]:
        return [email.lower() for email in self._parse_csv(self.cms_allowed_emails)]

    @property
    def effective_cms_cookie_secure(self) -> bool:
        if self.cms_cookie_secure is not None:
            return self.cms_cookie_secure
        return self.environment == "production"

    @property
    def public_site_base_url_clean(self) -> str:
        return self.public_site_base_url.rstrip("/")

    @property
    def cms_upload_path(self) -> Path:
        path = Path(self.cms_upload_dir)
        if not path.is_absolute():
            backend_root = Path(__file__).resolve().parents[4]
            path = backend_root / path
        return path

    @staticmethod
    def _parse_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
