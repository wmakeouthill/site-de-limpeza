from fastapi import HTTPException, status

from app.domain.entities.site import SiteScope
from app.infrastructure.config.settings import Settings


def resolve_site_from_host(host: str | None, settings: Settings | None = None) -> SiteScope:
    """Resolve o escopo único do site institucional da Falcão Limpeza."""
    _ = (host, settings)
    return SiteScope.FALCAO


def validate_site_scope(site: str | SiteScope | None) -> SiteScope:
    """Garante que apenas um escopo válido da Falcão Limpeza seja aceito."""
    if site is None:
        return SiteScope.FALCAO
    if isinstance(site, SiteScope):
        return site
    normalized = str(site).strip().lower()
    for scope in SiteScope:
        if normalized == scope.value:
            return scope
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Escopo de site invalido. Apenas 'falcao' e suportado.",
    )
