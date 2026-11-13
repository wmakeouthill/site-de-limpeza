from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

CMS_TIMEZONE = ZoneInfo("America/Sao_Paulo")
MAX_CMS_PERIOD_DAYS = 360


@dataclass(frozen=True)
class CmsPeriod:
    start_at: datetime
    end_at: datetime


def resolve_cms_period(
    *,
    from_date: date | None,
    to_date: date | None,
    days: int | None,
    now: datetime | None = None,
) -> CmsPeriod:
    """Resolve filtros CMS para uma janela UTC com fim exclusivo."""
    if (from_date is None) != (to_date is None):
        raise ValueError("Informe as duas datas do período.")

    if from_date is not None and to_date is not None:
        if to_date < from_date:
            raise ValueError("A data final deve ser igual ou posterior à inicial.")
        if (to_date - from_date).days + 1 > MAX_CMS_PERIOD_DAYS:
            raise ValueError("O período máximo é de 360 dias.")
        return CmsPeriod(
            start_at=datetime.combine(from_date, time.min, CMS_TIMEZONE).astimezone(UTC),
            end_at=datetime.combine(to_date + timedelta(days=1), time.min, CMS_TIMEZONE).astimezone(UTC),
        )

    resolved_days = days if days is not None else 30
    if not 1 <= resolved_days <= MAX_CMS_PERIOD_DAYS:
        raise ValueError("O período máximo é de 360 dias.")
    end_at = now or datetime.now(UTC)
    return CmsPeriod(start_at=end_at - timedelta(days=resolved_days), end_at=end_at)
