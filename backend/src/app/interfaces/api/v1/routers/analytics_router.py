import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.application.services.analytics_service import AnalyticsService
from app.domain.schemas.analytics import SiteEventBatch, TrackingForgetRequest
from app.infrastructure.config.settings import get_settings
from app.interfaces.api.v1.dependencies.services import get_analytics_service, resolve_request_site

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["Analytics"])
AnalyticsServiceDependency = Annotated[AnalyticsService, Depends(get_analytics_service)]

# Lido uma vez no import — o arquivo e estatico.
# parents[4] = .../src/app (routers < v1 < api < interfaces < app).
_TRACK_JS = (
    Path(__file__).resolve().parents[4] / "infrastructure" / "analytics" / "track.js"
).read_text(encoding="utf-8")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get("/track.js")
async def track_script() -> Response:
    """Script de medicao dos tres sites publicos (uma copia so, servida aqui)."""
    if not get_settings().analytics_enabled:
        # Desligado: devolve um script vazio em vez de 404, pra nao sujar o console.
        return Response("", media_type="application/javascript")
    return Response(
        _TRACK_JS,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"},
    )


@router.post("/events", status_code=status.HTTP_204_NO_CONTENT)
async def ingest_events(
    request: Request,
    payload: SiteEventBatch,
    service: AnalyticsServiceDependency,
) -> Response:
    """Ingestao do track.js. Sempre 204 — metrica nunca quebra a pagina.

    O `site` sai do Host (igual ao contato), nunca do corpo: senao qualquer um
    grava evento no canal que quiser.
    """
    settings = get_settings()
    if not settings.analytics_enabled:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    limiter = getattr(request.app.state, "events_rate_limiter", None)
    if limiter is not None and not limiter.allow(_client_ip(request)):
        # 204 silencioso: o client nao tem o que fazer com um 429 mesmo.
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    try:
        await service.record(payload.events, site=resolve_request_site(request, settings))
    except Exception:  # noqa: BLE001 - painel interno nao pode derrubar o site
        logger.exception("Analytics: falha ao gravar lote de eventos.")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tracking/forget", status_code=status.HTTP_204_NO_CONTENT)
async def forget_tracking(
    payload: TrackingForgetRequest,
    service: AnalyticsServiceDependency,
) -> Response:
    """Atende oposiÃ§Ã£o sem vazar se um identificador tinha dados no servidor."""
    try:
        await service.forget_attribution(payload.attribution_id)
    except Exception:  # noqa: BLE001 - o controle local ja foi aplicado no browser
        logger.exception("Analytics: falha ao esquecer atribuicao.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
