from datetime import UTC, date, datetime, timedelta
from typing import Protocol

from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import SiteEvent, utc_now
from app.domain.schemas.analytics import (
    AnalyticsChannel,
    AnalyticsDashboard,
    AnalyticsOverview,
    AnalyticsPageList,
    AnalyticsPeriod,
    AnalyticsPoint,
    AnalyticsRow,
    FunnelStep,
    SiteEventCreate,
    WeeklyRhythmPoint,
)
from app.infrastructure.repositories.site_event_repository import (
    SqlAlchemySiteEventRepository,
)

_WEEKDAY_LABELS = ("Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom")


class CampaignSourceLinkReader(Protocol):
    async def list_all(self) -> list[CampaignSourceLink]: ...


class AnalyticsService:
    """Grava os eventos do track.js e monta o painel do CMS."""

    def __init__(
        self,
        repository: SqlAlchemySiteEventRepository,
        campaign_links: CampaignSourceLinkReader | None = None,
    ) -> None:
        self._repository = repository
        self._campaign_links = campaign_links

    async def record(self, events: list[SiteEventCreate], *, site: SiteScope) -> int:
        """O site vem do Host, nunca do corpo: senao qualquer um forja canal."""
        received_at = utc_now()
        valid_events = [e for e in events if not e.page.startswith("/cms")]
        if not valid_events:
            return 0
        return await self._repository.add_many(
            SiteEvent(
                site=site,
                session_id=event.session_id,
                attribution_id=event.attribution_id,
                event=event.event,
                target=event.target[:200],
                page=event.page[:255],
                referrer=event.referrer,
                utm_source=event.utm_source,
                utm_medium=event.utm_medium,
                utm_campaign=event.utm_campaign,
                utm_term=event.utm_term,
                utm_content=event.utm_content,
                placement=event.placement,
                first_touch=event.first_touch.model_dump(mode="json")
                if event.first_touch
                else None,
                last_touch=event.last_touch.model_dump(mode="json")
                if event.last_touch
                else None,
                device=event.device,
                dwell_ms=event.dwell_ms,
                pos_x=event.pos_x,
                pos_y=event.pos_y,
                occurred_at=_safe_occurred_at(event.occurred_at, received_at),
                # Retenção e associação usam somente o horário de recebimento.
                created_at=received_at,
            )
            for event in valid_events
        )

    async def forget_attribution(self, attribution_id: str) -> None:
        await self._repository.forget_attribution(attribution_id)

    async def dashboard(
        self,
        *,
        site: SiteScope | None,
        days: int = 30,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> AnalyticsDashboard:
        if start_at is None or end_at is None:
            end_at = utc_now()
            start_at = end_at - timedelta(days=days)

        filters = self._repository.window(site, start_at=start_at, end_at=end_at)
        raw_overview = await self._repository.overview(filters)
        raw_timeseries = await self._repository.timeseries(filters)
        start_date = start_at.date()
        end_date = (end_at - timedelta(microseconds=1)).date()

        rollups = await self._repository.daily_rollups(
            site=site,
            start_day=start_date,
            end_day=end_date,
        )
        merged_overview = _merge_overview_with_rollups(
            raw_overview, raw_timeseries, rollups
        )
        overview = AnalyticsOverview(**merged_overview)
        timeseries = _fill_days(
            _merge_timeseries_with_rollups(raw_timeseries, rollups),
            start_date,
            end_date,
        )

        span = end_at - start_at
        comparison_start = start_at - span
        comparison_start_date = comparison_start.date()
        comparison_end_date = (start_at - timedelta(microseconds=1)).date()
        comparison_filters = self._repository.window(
            site,
            start_at=comparison_start,
            end_at=start_at,
        )
        raw_comp_overview = await self._repository.overview(comparison_filters)
        raw_comp_timeseries = await self._repository.timeseries(comparison_filters)
        comp_rollups = await self._repository.daily_rollups(
            site=site,
            start_day=comparison_start_date,
            end_day=comparison_end_date,
        )
        merged_comp_overview = _merge_overview_with_rollups(
            raw_comp_overview, raw_comp_timeseries, comp_rollups
        )
        comparison_overview = AnalyticsOverview(**merged_comp_overview)
        comparison_timeseries = _fill_days(
            _merge_timeseries_with_rollups(raw_comp_timeseries, comp_rollups),
            comparison_start_date,
            comparison_end_date,
        )

        channels = []
        for channel in (site,) if site is not None else tuple(SiteScope):
            channel_filters = self._repository.window(
                channel, start_at=start_at, end_at=end_at
            )
            raw_channel_overview = await self._repository.overview(channel_filters)
            raw_channel_timeseries = await self._repository.timeseries(channel_filters)
            channel_rollups = await self._repository.daily_rollups(
                site=channel,
                start_day=start_date,
                end_day=end_date,
            )
            merged_channel_overview = _merge_overview_with_rollups(
                raw_channel_overview, raw_channel_timeseries, channel_rollups
            )
            channels.append(
                AnalyticsChannel(
                    site=str(channel),
                    overview=AnalyticsOverview(**merged_channel_overview),
                )
            )

        link_index: dict[str, CampaignSourceLink] = {}
        if self._campaign_links is not None:
            link_index = {
                link.identifier: link for link in await self._campaign_links.list_all()
            }
        source_rows = await self._repository.sources(
            filters,
            campaign_links=link_index,
        )

        return AnalyticsDashboard(
            overview=overview,
            period=AnalyticsPeriod(
                start=start_at.date(),
                end=(end_at - timedelta(microseconds=1)).date(),
            ),
            comparison_overview=comparison_overview,
            timeseries=timeseries,
            comparison_timeseries=comparison_timeseries,
            weekly_rhythm=_weekly_rhythm(timeseries),
            pages_per_session=round(overview.pageviews / overview.visitors, 2)
            if overview.visitors
            else 0.0,
            channels=channels,
            funnel=[
                FunnelStep(**row) for row in await self._repository.funnel(filters)
            ],
            top_pages=[
                AnalyticsRow(**row) for row in await self._repository.top_pages(filters)
            ],
            top_ctas=[
                AnalyticsRow(**row) for row in await self._repository.top_ctas(filters)
            ],
            sources=[AnalyticsRow(**row) for row in source_rows],
            devices=[
                AnalyticsRow(**row) for row in await self._repository.devices(filters)
            ],
            whatsapp_clicks=[
                AnalyticsRow(**row) for row in await self._repository.whatsapp_clicks(filters)
            ],
            top_lista_products=[
                AnalyticsRow(**row) for row in await self._repository.top_lista_products(filters)
            ],
            top_search_terms=[
                AnalyticsRow(**row) for row in await self._repository.top_search_terms(filters)
            ],
            promotions_summary=[
                AnalyticsRow(**row) for row in await self._repository.promotions_summary(filters)
            ],
        )

    async def pages(
        self,
        *,
        site: SiteScope | None,
        days: int = 30,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        page: int,
        page_size: int,
    ) -> AnalyticsPageList:
        if start_at is None or end_at is None:
            end_at = utc_now()
            start_at = end_at - timedelta(days=days)
        filters = self._repository.window(site, start_at=start_at, end_at=end_at)
        items, total = await self._repository.pages(
            filters, page=page, page_size=page_size
        )
        return AnalyticsPageList(
            items=items, total=total, page=page, page_size=page_size
        )


def _safe_occurred_at(value: datetime | None, received_at: datetime) -> datetime:
    if value is None:
        return received_at
    occurred_at = value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    occurred_at = occurred_at.astimezone(UTC)
    if (
        received_at - timedelta(hours=24)
        <= occurred_at
        <= received_at + timedelta(minutes=5)
    ):
        return occurred_at
    return received_at


def _merge_timeseries_with_rollups(raw_rows: list[dict], rollups: list) -> list[dict]:
    by_day: dict[str, dict] = {str(row["day"]): dict(row) for row in raw_rows}
    for rollup in rollups:
        day_str = str(rollup.day)
        overview = rollup.payload.get("overview", {})
        visitors = int(overview.get("visitors", 0))
        pageviews = int(overview.get("pageviews", 0))
        if day_str not in by_day:
            by_day[day_str] = {
                "day": rollup.day,
                "visitors": visitors,
                "pageviews": pageviews,
                "by_site": [
                    {
                        "site": str(rollup.site),
                        "visitors": visitors,
                        "pageviews": pageviews,
                    }
                ],
            }
        else:
            current = by_day[day_str]
            sites = {item["site"] for item in current.get("by_site", [])}
            if str(rollup.site) not in sites:
                current["visitors"] += visitors
                current["pageviews"] += pageviews
                current.setdefault("by_site", []).append(
                    {
                        "site": str(rollup.site),
                        "visitors": visitors,
                        "pageviews": pageviews,
                    }
                )
    return list(by_day.values())


def _merge_overview_with_rollups(
    raw_overview: dict[str, int | float],
    raw_timeseries: list[dict],
    rollups: list,
) -> dict[str, int | float]:
    result = dict(raw_overview)
    raw_days = {str(row["day"]) for row in raw_timeseries}
    for rollup in rollups:
        if str(rollup.day) not in raw_days:
            overview = rollup.payload.get("overview", {})
            result["visitors"] = int(result.get("visitors", 0)) + int(
                overview.get("visitors", 0)
            )
            result["pageviews"] = int(result.get("pageviews", 0)) + int(
                overview.get("pageviews", 0)
            )
            result["clicks"] = int(result.get("clicks", 0)) + int(
                overview.get("clicks", 0)
            )
            result["form_submits"] = int(result.get("form_submits", 0)) + int(
                overview.get("form_submits", 0)
            )
    return result


def _fill_days(rows: list[dict], start: date, end: date) -> list[AnalyticsPoint]:
    values = {
        date.fromisoformat(str(row["day"])): AnalyticsPoint(**row) for row in rows
    }
    points = []
    current = start
    while current <= end:
        points.append(values.get(current, AnalyticsPoint(day=current)))
        current += timedelta(days=1)
    return points


def _weekly_rhythm(points: list[AnalyticsPoint]) -> list[WeeklyRhythmPoint]:
    totals = [0] * 7
    for point in points:
        day = (
            point.day
            if isinstance(point.day, date)
            else date.fromisoformat(str(point.day))
        )
        totals[day.weekday()] += point.visitors
    return [
        WeeklyRhythmPoint(weekday=index, label=_WEEKDAY_LABELS[index], visitors=value)
        for index, value in enumerate(totals)
    ]
