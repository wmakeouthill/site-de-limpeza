import logging

from app.infrastructure.config.settings import get_settings
from app.infrastructure.repositories.site_event_repository import (
    SqlAlchemySiteEventRepository,
)

logger = logging.getLogger(__name__)


async def run_analytics_retention(
    repository: SqlAlchemySiteEventRepository,
    days: int | None = None,
) -> int:
    """Executa a rotina de retenção de eventos de analytics.

    Agrega detalhes em rollups diários (DailyAnalyticsRollup) e remove apenas
    SiteEvent expirados.
    NUNCA remove ou modifica registros de ContactMessage.
    """
    if days is None:
        days = get_settings().analytics_retention_days

    logger.info(
        "Iniciando rotina de retenção de analytics para eventos anteriores a %d dias...",
        days,
    )
    purged = await repository.archive_and_purge_older_than(days)
    logger.info(
        "Rotina de retenção concluída: %d eventos agregados e expurgados.",
        purged,
    )
    return purged
