import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.infrastructure.config.settings import Settings

CMS_TOKEN_ISSUER = "talimpo-cms"
CMS_ACCESS_AUDIENCE = "talimpo-cms-access"
CMS_REFRESH_AUDIENCE = "talimpo-cms-refresh"


class CmsSessionError(Exception):
    pass


@dataclass(frozen=True)
class CmsUser:
    email: str
    name: str
    object_id: str
    subject: str = ""
    photo_url: str = ""


@dataclass(frozen=True)
class AccessSession:
    user: CmsUser
    csrf_token: str
    session_id: str = ""


@dataclass(frozen=True)
class RefreshSession:
    session_id: str
    token_id: str


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _secret(settings: Settings) -> str:
    if not settings.cms_session_secret:
        raise CmsSessionError("CMS_SESSION_SECRET nao configurado no backend.")
    return settings.cms_session_secret


def create_access_token(
    user: CmsUser,
    settings: Settings,
    csrf_token: str | None = None,
    session_id: str = "",
) -> tuple[str, str]:
    now = datetime.now(UTC)
    csrf = csrf_token or secrets.token_urlsafe(32)
    ttl_minutes = min(15, max(1, settings.cms_access_token_ttl_minutes))
    payload = {
        "sub": user.subject or user.object_id,
        "email": user.email,
        "name": user.name,
        "oid": user.object_id,
        "photo": user.photo_url,
        "csrf": csrf,
        "sid": session_id,
        "iss": CMS_TOKEN_ISSUER,
        "aud": CMS_ACCESS_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=ttl_minutes),
    }
    token = jwt.encode(payload, _secret(settings), algorithm="HS256")
    return token, csrf


def validate_access_token(token: str, settings: Settings) -> AccessSession:
    try:
        payload = jwt.decode(
            token,
            key=_secret(settings),
            algorithms=["HS256"],
            audience=CMS_ACCESS_AUDIENCE,
            issuer=CMS_TOKEN_ISSUER,
            options={"require": ["exp", "sub", "email", "oid", "csrf"]},
        )
    except jwt.PyJWTError as error:
        raise CmsSessionError("Sessao do CMS invalida ou expirada.") from error

    csrf = str(payload.get("csrf") or "")
    if not csrf:
        raise CmsSessionError("Sessao do CMS sem token CSRF.")

    user = CmsUser(
        subject=str(payload["sub"]),
        email=str(payload["email"]),
        name=str(payload.get("name") or payload["email"]),
        object_id=str(payload["oid"]),
        photo_url=str(payload.get("photo") or ""),
    )
    session_id = str(payload.get("sid") or "")
    return AccessSession(user=user, csrf_token=csrf, session_id=session_id)


def create_refresh_token(session_id: str, settings: Settings) -> str:
    now = datetime.now(UTC)
    token_id = secrets.token_urlsafe(32)
    payload = {
        "sid": session_id,
        "jti": token_id,
        "iss": CMS_TOKEN_ISSUER,
        "aud": CMS_REFRESH_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(days=settings.cms_refresh_token_ttl_days),
    }
    return jwt.encode(payload, _secret(settings), algorithm="HS256")


def validate_refresh_token(token: str, settings: Settings) -> RefreshSession:
    try:
        payload = jwt.decode(
            token,
            key=_secret(settings),
            algorithms=["HS256"],
            audience=CMS_REFRESH_AUDIENCE,
            issuer=CMS_TOKEN_ISSUER,
            options={"require": ["exp", "sid", "jti"]},
        )
    except jwt.PyJWTError as error:
        raise CmsSessionError("Refresh token do CMS invalido ou expirado.") from error

    session_id = str(payload.get("sid") or "")
    token_id = str(payload.get("jti") or "")
    if not session_id or not token_id:
        raise CmsSessionError("Refresh token do CMS incompleto.")
    return RefreshSession(session_id=session_id, token_id=token_id)


def extract_session_id_unverified(token: str | None, settings: Settings) -> str:
    if not token or not settings.cms_session_secret:
        return ""
    try:
        payload = jwt.decode(
            token,
            key=settings.cms_session_secret,
            algorithms=["HS256"],
            issuer=CMS_TOKEN_ISSUER,
            options={"verify_aud": False, "verify_exp": False},
        )
        return str(payload.get("sid") or "")
    except jwt.PyJWTError:
        return ""

