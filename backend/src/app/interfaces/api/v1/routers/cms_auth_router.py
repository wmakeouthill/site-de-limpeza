import logging
import secrets
from dataclasses import replace
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.application.services.cms_author_service import CmsAuthorService
from app.application.services.cms_content_service import CmsContentService
from app.domain.entities.cms_session import CmsSession, generate_session_id, utc_now
from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.repositories.cms_session_repository import (
    SqlAlchemyCmsSessionRepository,
)
from app.infrastructure.security.cms_session import (
    CmsSessionError,
    CmsUser,
    create_access_token,
    create_refresh_token,
    extract_session_id_unverified,
    hash_token,
    validate_access_token,
    validate_refresh_token,
)
from app.infrastructure.security.rate_limiter import SlidingWindowRateLimiter
from app.interfaces.api.v1.cms_cookies import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    clear_session_cookies,
    set_session_cookies,
)
from app.interfaces.api.v1.dependencies.auth import (
    require_cms_user,
    validate_request_origin,
)
from app.interfaces.api.v1.dependencies.services import (
    get_cms_author_service,
    get_cms_content_service,
    get_cms_login_rate_limiter,
    get_cms_session_repository,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cms/auth", tags=["CMS Auth"])


class CmsLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
async def cms_login(
    payload: CmsLoginRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    cms_session_repo: Annotated[
        SqlAlchemyCmsSessionRepository, Depends(get_cms_session_repository)
    ],
    cms_author_service: Annotated[CmsAuthorService, Depends(get_cms_author_service)],
    rate_limiter: Annotated[SlidingWindowRateLimiter, Depends(get_cms_login_rate_limiter)],
) -> Response:
    validate_request_origin(request, settings)

    email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    # Conta nas duas chaves sempre (sem curto-circuito): trocar de e-mail nao zera o IP.
    ip_allowed = rate_limiter.allow(f"ip:{client_ip}")
    email_allowed = rate_limiter.allow(f"email:{email}")
    if not (ip_allowed and email_allowed):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde alguns minutos.",
        )

    author = await cms_author_service.authenticate(email, payload.password)
    if author is None:
        logger.warning("CMS login recusado (ip=%s).", client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha invalidos.",
        )

    # So depois da senha correta: um 403 aqui nao revela quais e-mails existem.
    if author.email not in settings.cms_allowed_email_list:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="E-mail nao autorizado para o CMS.",
        )

    user = CmsUser(
        email=author.email,
        name=author.name or author.email,
        object_id=author.email,
        subject=author.email,
        photo_url=author.photo_url or "",
    )
    try:
        access_token, refresh_token, csrf_token = await _start_session(
            user, settings, cms_session_repo
        )
    except CmsSessionError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    set_session_cookies(response, access_token, refresh_token, csrf_token, settings)
    return response


async def _start_session(
    user: CmsUser,
    settings: Settings,
    cms_session_repo: SqlAlchemyCmsSessionRepository,
) -> tuple[str, str, str]:
    session_id = generate_session_id()
    refresh_token = create_refresh_token(session_id, settings)
    access_token, csrf_token = create_access_token(
        user,
        settings,
        csrf_token=secrets.token_urlsafe(32),
        session_id=session_id,
    )

    now = utc_now()
    await cms_session_repo.create(
        CmsSession(
            id=session_id,
            user_email=user.email,
            user_name=user.name,
            user_object_id=user.object_id,
            user_photo_url=user.photo_url,
            refresh_token_hash=hash_token(refresh_token),
            csrf_token_hash=hash_token(csrf_token),
            expires_at=now + timedelta(days=settings.cms_refresh_token_ttl_days),
            created_at=now,
            updated_at=now,
        )
    )
    return access_token, refresh_token, csrf_token


class CmsProfilePhotoUpdate(BaseModel):
    photo_url: str = Field(..., min_length=1, max_length=1000)


@router.get("/me")
async def cms_me(
    user: Annotated[CmsUser, Depends(require_cms_user)],
    csrf_cookie: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
) -> dict[str, str]:
    return {
        "email": user.email,
        "name": user.name,
        "photoUrl": user.photo_url,
        "csrfToken": csrf_cookie or "",
    }


@router.put("/photo")
async def cms_update_photo(
    payload: CmsProfilePhotoUpdate,
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
    user: Annotated[CmsUser, Depends(require_cms_user)],
    cms_session_repo: Annotated[
        SqlAlchemyCmsSessionRepository, Depends(get_cms_session_repository)
    ],
    cms_content_service: Annotated[CmsContentService, Depends(get_cms_content_service)],
    cms_author_service: Annotated[CmsAuthorService, Depends(get_cms_author_service)],
    access_cookie: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
) -> dict[str, str]:
    updated_user = replace(user, photo_url=payload.photo_url)
    await cms_content_service.update_author_photo(user.email, payload.photo_url)
    await cms_author_service.upsert(
        email=user.email,
        name=user.name,
        photo_url=payload.photo_url,
    )

    session_id = ""
    if access_cookie:
        try:
            session_id = validate_access_token(access_cookie, settings).session_id
        except CmsSessionError:
            session_id = extract_session_id_unverified(access_cookie, settings)

    if session_id:
        db_session = await cms_session_repo.find_by_id(session_id)
        if db_session is not None and db_session.is_active():
            db_session.user_photo_url = payload.photo_url
            await cms_session_repo.save(db_session)

    effective_csrf = csrf_cookie or secrets.token_urlsafe(32)
    access_token, csrf_token = create_access_token(
        updated_user,
        settings,
        csrf_token=effective_csrf,
        session_id=session_id,
    )
    set_session_cookies(response, access_token, None, csrf_token, settings)
    return {
        "email": updated_user.email,
        "name": updated_user.name,
        "photoUrl": updated_user.photo_url,
        "csrfToken": csrf_token,
    }


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
async def cms_refresh(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    cms_session_repo: Annotated[
        SqlAlchemyCmsSessionRepository, Depends(get_cms_session_repository)
    ],
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> Response:
    validate_request_origin(request, settings)

    if not refresh_cookie:
        return _unauthorized_clearing_cookies("Refresh token ausente.", settings)

    try:
        refresh_session = validate_refresh_token(refresh_cookie, settings)
    except CmsSessionError as error:
        return _unauthorized_clearing_cookies(str(error), settings)

    db_session = await cms_session_repo.find_by_id(refresh_session.session_id)
    if db_session is None or not db_session.is_active():
        return _unauthorized_clearing_cookies("Sessao expirada ou revogada.", settings)

    incoming_hash = hash_token(refresh_cookie)
    if not secrets.compare_digest(incoming_hash, db_session.refresh_token_hash):
        await cms_session_repo.revoke(db_session.id)
        return _unauthorized_clearing_cookies(
            "Reuso de refresh token detectado; sessao revogada.",
            settings,
        )

    allowed_emails = settings.cms_allowed_email_list
    if not allowed_emails or db_session.user_email.lower() not in allowed_emails:
        await cms_session_repo.revoke(db_session.id)
        response = JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "E-mail nao autorizado para o CMS."},
        )
        clear_session_cookies(response, settings)
        return response

    new_csrf_token = secrets.token_urlsafe(32)
    new_refresh_token = create_refresh_token(db_session.id, settings)
    db_session.refresh_token_hash = hash_token(new_refresh_token)
    db_session.csrf_token_hash = hash_token(new_csrf_token)
    db_session.expires_at = utc_now() + timedelta(days=settings.cms_refresh_token_ttl_days)
    await cms_session_repo.save(db_session)

    user = CmsUser(
        subject=db_session.user_object_id or db_session.user_email,
        email=db_session.user_email,
        name=db_session.user_name or db_session.user_email,
        object_id=db_session.user_object_id or db_session.user_email,
        photo_url=db_session.user_photo_url,
    )
    access_token, csrf_token = create_access_token(
        user,
        settings,
        csrf_token=new_csrf_token,
        session_id=db_session.id,
    )

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    set_session_cookies(response, access_token, new_refresh_token, csrf_token, settings)
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def cms_logout(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    cms_session_repo: Annotated[
        SqlAlchemyCmsSessionRepository, Depends(get_cms_session_repository)
    ],
    access_cookie: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
    refresh_cookie: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> Response:
    validate_request_origin(request, settings)

    session_id = ""
    if access_cookie:
        try:
            session_id = validate_access_token(access_cookie, settings).session_id
        except CmsSessionError:
            session_id = extract_session_id_unverified(access_cookie, settings)
    if not session_id and refresh_cookie:
        try:
            session_id = validate_refresh_token(refresh_cookie, settings).session_id
        except CmsSessionError:
            session_id = extract_session_id_unverified(refresh_cookie, settings)

    if session_id:
        await cms_session_repo.revoke(session_id)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookies(response, settings)
    return response


def _unauthorized_clearing_cookies(detail: str, settings: Settings) -> JSONResponse:
    response = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": detail},
    )
    clear_session_cookies(response, settings)
    return response
