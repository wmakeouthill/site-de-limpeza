import secrets
from dataclasses import replace
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Cookie, Depends, Header, HTTPException, Request, status

from app.application.services.cms_author_service import CmsAuthorService
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.repositories.cms_session_repository import (
    SqlAlchemyCmsSessionRepository,
)
from app.infrastructure.security.cms_session import (
    CmsSessionError,
    CmsUser,
    hash_token,
    validate_access_token,
)
from app.interfaces.api.v1.cms_cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.interfaces.api.v1.dependencies.services import (
    get_cms_author_service,
    get_cms_session_repository,
)

_MUTATION_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def allowed_mutation_origins(settings: Settings) -> set[str]:
    origins = {origin.rstrip("/") for origin in settings.cors_origin_list if origin}
    if settings.public_site_base_url_clean:
        origins.add(settings.public_site_base_url_clean)
    if settings.cms_frontend_url:
        parsed = urlsplit(settings.cms_frontend_url)
        if parsed.scheme and parsed.netloc:
            origins.add(f"{parsed.scheme}://{parsed.netloc}".rstrip("/"))
    return origins


def validate_request_origin(request: Request, settings: Settings) -> None:
    raw_origin = (request.headers.get("origin") or "").strip()
    if not raw_origin:
        return
    normalized_origin = raw_origin.rstrip("/")
    if normalized_origin not in allowed_mutation_origins(settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Origem da requisicao nao autorizada.",
        )


async def require_cms_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    cms_session_repo: Annotated[
        SqlAlchemyCmsSessionRepository, Depends(get_cms_session_repository)
    ],
    author_service: Annotated[CmsAuthorService, Depends(get_cms_author_service)],
    access_cookie: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
    x_csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> CmsUser:
    if not access_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao do CMS ausente.",
        )

    try:
        access = validate_access_token(access_cookie, settings)
    except CmsSessionError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error

    if not access.session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao do CMS sem identificador persistido.",
        )

    db_session = await cms_session_repo.find_by_id(access.session_id)
    if db_session is None or not db_session.is_active():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao do CMS expirada ou revogada.",
        )

    allowed_emails = settings.cms_allowed_email_list
    if not allowed_emails or access.user.email.lower() not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="E-mail nao autorizado para o CMS.",
        )

    if request.method in _MUTATION_METHODS:
        validate_request_origin(request, settings)
        if (
            not csrf_cookie
            or not x_csrf_token
            or not secrets.compare_digest(csrf_cookie, access.csrf_token)
            or not secrets.compare_digest(x_csrf_token, csrf_cookie)
            or not secrets.compare_digest(
                hash_token(x_csrf_token),
                db_session.csrf_token_hash,
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token CSRF invalido.",
            )

    user = access.user
    if db_session.user_photo_url or db_session.user_name:
        user = replace(
            user,
            name=db_session.user_name or user.name,
            photo_url=db_session.user_photo_url or user.photo_url,
        )

    try:
        await author_service.upsert(
            email=user.email,
            name=user.name,
            photo_url=user.photo_url,
        )
    except Exception:
        pass

    return user
