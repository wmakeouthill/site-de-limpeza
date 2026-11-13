from fastapi import Response

from app.infrastructure.config.settings import Settings

ACCESS_COOKIE = "talimpo_cms_access"
REFRESH_COOKIE = "talimpo_cms_refresh"
CSRF_COOKIE = "talimpo_cms_csrf"


def set_session_cookies(
    response: Response,
    access_token: str,
    refresh_token: str | None,
    csrf_token: str,
    settings: Settings,
) -> None:
    secure = settings.effective_cms_cookie_secure
    domain = settings.cms_cookie_domain or None
    access_ttl_minutes = min(15, max(1, settings.cms_access_token_ttl_minutes))
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=access_ttl_minutes * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        max_age=settings.cms_refresh_token_ttl_days * 86400,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        domain=domain,
    )
    if refresh_token:
        response.set_cookie(
            key=REFRESH_COOKIE,
            value=refresh_token,
            max_age=settings.cms_refresh_token_ttl_days * 86400,
            httponly=True,
            secure=secure,
            samesite="lax",
            path="/api/cms/auth",
            domain=domain,
        )


def clear_session_cookies(response: Response, settings: Settings) -> None:
    domain = settings.cms_cookie_domain or None
    response.delete_cookie(key=ACCESS_COOKIE, path="/", domain=domain)
    response.delete_cookie(key=CSRF_COOKIE, path="/", domain=domain)
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/cms/auth", domain=domain)

