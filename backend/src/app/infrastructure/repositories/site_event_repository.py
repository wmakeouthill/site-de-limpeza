import re
import unicodedata
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from urllib.parse import unquote_plus

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import (
    DailyAnalyticsRollup,
    SiteEvent,
    SiteEventType,
    lead_submission_prefix,
)

_LEAD_MARKER_WINDOW = timedelta(minutes=5)
_JOURNEY_WINDOW = timedelta(hours=24)
_JOURNEY_MAX_EVENTS = 200

# Aliases emitidos pela Meta (`site_source_name`) e por UTMs manuais. A chave
# bruta continua no evento; estes mapas servem apenas para agrupar e exibir.
_SOURCE_ALIASES = {
    "ig": "instagram",
    "instagram": "instagram",
    "fb": "facebook",
    "facebook": "facebook",
    "an": "audience-network",
    "audience-network": "audience-network",
    "msg": "messenger",
    "messenger": "messenger",
    "meta": "meta",
}
_SOURCE_LABELS = {
    "instagram": "Instagram",
    "facebook": "Facebook",
    "audience-network": "Audience Network",
    "messenger": "Messenger",
    "meta": "Meta",
}
_MEDIUM_ALIASES = {
    "paid": "paid",
    "cpc": "paid",
    "ppc": "paid",
    "paid-social": "paid",
    "paid_social": "paid",
    "organic": "organic",
    "social": "social",
    "email": "email",
    "referral": "referral",
    "none": "none",
}
_MEDIUM_LABELS = {
    "paid": "M\u00eddia paga",
    "organic": "Org\u00e2nico",
    "social": "Social",
    "email": "E-mail",
    "referral": "Refer\u00eancia",
    "none": "Direto",
}
_CAMPAIGN_ID = re.compile(r"\d{8,30}\Z")
_CAMPAIGN_NONE = "(sem campanha)"

# Passos do funil, na ordem. O rotulo vai direto pro dashboard.
FUNNEL_STEPS: tuple[tuple[SiteEventType, str, str], ...] = (
    (SiteEventType.PAGEVIEW, "pageview", "Entrou no site"),
    (SiteEventType.CASE_VIEW, "case_view", "Viu um case"),
    (SiteEventType.SCROLL, "scroll", "Rolou a página"),
    (SiteEventType.CLICK, "click", "Clicou em algo"),
    (SiteEventType.FORM_OPEN, "form_open", "Abriu o formulário"),
    (SiteEventType.FORM_SUBMIT, "form_submit", "Enviou o formulário"),
)

# Eventos que provam interacao: quem so tem pageview e rejeicao (bounce).
_ENGAGED_EVENTS = (
    SiteEventType.SCROLL,
    SiteEventType.CLICK,
    SiteEventType.FORM_OPEN,
    SiteEventType.FORM_SUBMIT,
)


class SqlAlchemySiteEventRepository:
    """Ingestao e agregados dos eventos de uso.

    Sem ABC de dominio e sem variante aura de proposito: a tabela e local e tem
    uma implementacao so (mesmo caminho de `article_likes`).

    As consultas evitam SQL exclusivo do Postgres (`percentile_cont`, `filter`)
    porque a suite roda em SQLite in-memory.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add_many(self, events: Iterable[SiteEvent]) -> int:
        rows = list(events)
        if not rows:
            return 0
        try:
            self.session.add_all(rows)
            await self.session.commit()
            return len(rows)
        except Exception:
            await self.session.rollback()
            raise

    async def archive_and_purge_older_than(self, days: int) -> int:
        """Converte detalhes vencidos em agregados diarios antes de removê-los."""
        cutoff = datetime.now(UTC) - timedelta(days=days)
        try:
            rows = list(
                (
                    await self.session.execute(
                        select(SiteEvent)
                        .where(SiteEvent.created_at < cutoff)
                        .order_by(SiteEvent.created_at.asc(), SiteEvent.id.asc())
                    )
                ).scalars()
            )
            grouped: dict[tuple[SiteScope, date], list[SiteEvent]] = {}
            for event in rows:
                grouped.setdefault((event.site, event.created_at.date()), []).append(
                    event
                )

            for (site, day), events in grouped.items():
                existing = await self.session.scalar(
                    select(DailyAnalyticsRollup).where(
                        DailyAnalyticsRollup.site == site,
                        DailyAnalyticsRollup.day == day,
                    )
                )
                payload = _daily_payload(events)
                if existing is None:
                    self.session.add(
                        DailyAnalyticsRollup(site=site, day=day, payload=payload)
                    )
                else:
                    existing.payload = _merge_daily_payload(existing.payload, payload)

            result = await self.session.execute(
                delete(SiteEvent)
                .where(SiteEvent.created_at < cutoff)
                .execution_options(synchronize_session=False)
            )
            await self.session.commit()
            return int(result.rowcount or 0)
        except Exception:
            await self.session.rollback()
            raise

    async def purge_older_than(self, days: int) -> int:
        """Compatibilidade com o chamador anterior; agora arquiva antes do expurgo."""
        return await self.archive_and_purge_older_than(days)

    async def forget_attribution(self, attribution_id: str) -> None:
        """Remove todo detalhe vinculavel sem informar se havia registros."""
        try:
            await self.session.execute(
                delete(SiteEvent)
                .where(SiteEvent.attribution_id == attribution_id)
                .execution_options(synchronize_session=False)
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

    async def daily_rollups(
        self,
        *,
        site: SiteScope | None = None,
        start_day: date | None = None,
        end_day: date | None = None,
    ) -> list[DailyAnalyticsRollup]:
        statement = select(DailyAnalyticsRollup).order_by(
            DailyAnalyticsRollup.day.asc(), DailyAnalyticsRollup.site.asc()
        )
        if site is not None:
            statement = statement.where(DailyAnalyticsRollup.site == site)
        if start_day is not None:
            statement = statement.where(DailyAnalyticsRollup.day >= start_day)
        if end_day is not None:
            statement = statement.where(DailyAnalyticsRollup.day <= end_day)
        return list((await self.session.execute(statement)).scalars())

    async def find_lead_marker(
        self,
        *,
        contact_id: str,
        site: SiteScope,
        submitted_at: datetime,
    ) -> SiteEvent | None:
        """Busca o marcador em uma janela curta ao redor da criação do contato.

        `occurred_at` vem do navegador e pode anteceder alguns segundos o save
        do contato; a janela também tolera esse intervalo sem associar por IP.
        """
        result = await self.session.execute(
            select(SiteEvent)
            .where(
                SiteEvent.site == site,
                SiteEvent.created_at >= submitted_at - _LEAD_MARKER_WINDOW,
                SiteEvent.created_at <= submitted_at + _LEAD_MARKER_WINDOW,
                SiteEvent.target.like(f"{lead_submission_prefix(contact_id)}%"),
            )
            .order_by(SiteEvent.created_at.asc(), SiteEvent.id.asc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def events_for_session_until(
        self,
        *,
        session_id: str,
        site: SiteScope,
        marker_at: datetime,
    ) -> tuple[list[SiteEvent], bool]:
        """Retorna a cauda da jornada, limitada para manter o modal responsivo."""
        occurred_at = func.coalesce(SiteEvent.occurred_at, SiteEvent.created_at)
        result = await self.session.execute(
            select(SiteEvent)
            .where(
                SiteEvent.session_id == session_id,
                SiteEvent.site == site,
                SiteEvent.created_at >= marker_at - _JOURNEY_WINDOW,
                SiteEvent.created_at <= marker_at,
            )
            .order_by(occurred_at.desc(), SiteEvent.id.desc())
            .limit(_JOURNEY_MAX_EVENTS + 1)
        )
        rows = list(result.scalars().all())
        truncated = len(rows) > _JOURNEY_MAX_EVENTS
        return list(reversed(rows[:_JOURNEY_MAX_EVENTS])), truncated

    # -- agregados do dashboard -------------------------------------------

    def window(
        self,
        site: SiteScope | None,
        days: int = 30,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list:
        """Filtros comuns a todos os agregados: janela de dias + site opcional."""
        if start_at is not None and end_at is not None:
            filters = [SiteEvent.created_at >= start_at, SiteEvent.created_at <= end_at]
        else:
            since = datetime.now(UTC) - timedelta(days=days)
            filters = [SiteEvent.created_at >= since]
        if site is not None:
            filters.append(SiteEvent.site == site)
        return filters

    async def _sessions_with(
        self,
        filters: list,
        events: Iterable[SiteEventType],
    ) -> int:
        total = await self.session.scalar(
            select(func.count(func.distinct(SiteEvent.session_id))).where(
                *filters,
                SiteEvent.event.in_(list(events)),
            )
        )
        return int(total or 0)

    async def _count_events(self, filters: list, event: SiteEventType) -> int:
        total = await self.session.scalar(
            select(func.count(SiteEvent.id)).where(*filters, SiteEvent.event == event)
        )
        return int(total or 0)

    async def median_dwell_ms(self, filters: list) -> int:
        """Mediana do tempo total por sessao.

        O track.js manda deltas (uma linha por ida e volta na aba, por pagina),
        entao a permanencia da visita e a SOMA das linhas da sessao.

        ponytail: em contagem par pega o valor de cima em vez de interpolar —
        num painel de permanencia a diferenca nao muda decisao nenhuma.
        """
        por_sessao = (
            select(func.sum(SiteEvent.dwell_ms).label("total"))
            .where(*filters, SiteEvent.event == SiteEventType.ENGAGEMENT)
            .group_by(SiteEvent.session_id)
            .subquery()
        )
        total = await self.session.scalar(select(func.count()).select_from(por_sessao))
        if not total:
            return 0
        value = await self.session.scalar(
            select(por_sessao.c.total)
            .order_by(por_sessao.c.total)
            .offset(int(total) // 2)
            .limit(1)
        )
        return int(value or 0)

    async def overview(self, filters: list) -> dict[str, int | float]:
        visitors = await self._sessions_with(filters, [SiteEventType.PAGEVIEW])
        engaged = await self._sessions_with(filters, _ENGAGED_EVENTS)
        return {
            "visitors": visitors,
            "pageviews": await self._count_events(filters, SiteEventType.PAGEVIEW),
            "clicks": await self._count_events(filters, SiteEventType.CLICK),
            "form_submits": await self._count_events(
                filters, SiteEventType.FORM_SUBMIT
            ),
            "median_dwell_ms": await self.median_dwell_ms(filters),
            # Rejeicao = entrou e nao interagiu com nada.
            "bounce_rate": round((visitors - engaged) / visitors * 100, 1)
            if visitors
            else 0.0,
        }

    async def timeseries(self, filters: list) -> list[dict]:
        day = func.date(SiteEvent.created_at)
        result = await self.session.execute(
            select(
                day.label("day"),
                SiteEvent.site,
                func.count(func.distinct(SiteEvent.session_id)).label("visitors"),
                func.count(SiteEvent.id).label("pageviews"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.PAGEVIEW)
            .group_by(day, SiteEvent.site)
            .order_by(day, SiteEvent.site)
        )
        points: dict[str, dict] = {}
        for row in result:
            key = str(row.day)
            point = points.setdefault(
                key,
                {"day": row.day, "visitors": 0, "pageviews": 0, "by_site": []},
            )
            visitors = int(row.visitors or 0)
            pageviews = int(row.pageviews or 0)
            point["visitors"] += visitors
            point["pageviews"] += pageviews
            point["by_site"].append(
                {"site": str(row.site), "visitors": visitors, "pageviews": pageviews}
            )
        return list(points.values())

    async def funnel(self, filters: list) -> list[dict]:
        steps = []
        first = 0
        for index, (event, step, label) in enumerate(FUNNEL_STEPS):
            by_site = await self._sessions_by_site(filters, [event])
            sessions = sum(item["count"] for item in by_site)
            if index == 0:
                first = sessions
            steps.append(
                {
                    "step": step,
                    "label": label,
                    "sessions": sessions,
                    "by_site": by_site,
                    "rate": round(sessions / first * 100, 1) if first else 0.0,
                }
            )
        return steps

    async def _sessions_by_site(
        self,
        filters: list,
        events: Iterable[SiteEventType],
    ) -> list[dict]:
        result = await self.session.execute(
            select(
                SiteEvent.site,
                func.count(func.distinct(SiteEvent.session_id)).label("count"),
            )
            .where(*filters, SiteEvent.event.in_(list(events)))
            .group_by(SiteEvent.site)
        )
        return _site_breakdown({str(row.site): int(row.count or 0) for row in result})

    async def top_pages(self, filters: list, limit: int = 10) -> list[dict]:
        result = await self.session.execute(
            select(
                SiteEvent.page,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.PAGEVIEW)
            .group_by(SiteEvent.page, SiteEvent.site)
        )
        pages: dict[str, dict[str, int]] = {}
        for row in result:
            label = row.page or "/"
            site_counts = pages.setdefault(label, {})
            site = str(row.site)
            site_counts[site] = site_counts.get(site, 0) + int(row.count)

        ranked = sorted(
            pages.items(),
            key=lambda item: sum(item[1].values()),
            reverse=True,
        )[:limit]
        return [
            {
                "label": label,
                "count": sum(site_counts.values()),
                "by_site": _site_breakdown(site_counts),
            }
            for label, site_counts in ranked
        ]

    async def pages(
        self, filters: list, *, page: int, page_size: int
    ) -> tuple[list[dict], int]:
        """Lista todas as rotas reais por site, sem o corte do ranking global."""
        path = func.coalesce(func.nullif(SiteEvent.page, ""), "/").label("path")
        pageviews = func.count(SiteEvent.id).label("pageviews")
        grouped = (
            select(SiteEvent.site.label("site"), path, pageviews)
            .where(*filters, SiteEvent.event == SiteEventType.PAGEVIEW)
            .group_by(SiteEvent.site, path)
        )
        total = int(
            (
                await self.session.execute(
                    select(func.count()).select_from(grouped.subquery())
                )
            ).scalar_one()
            or 0
        )
        result = await self.session.execute(
            grouped.order_by(pageviews.desc(), SiteEvent.site.asc(), path.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return [
            {
                "site": str(row.site),
                "path": str(row.path),
                "pageviews": int(row.pageviews),
            }
            for row in result
        ], total

    async def top_ctas(self, filters: list, limit: int = 15) -> list[dict]:
        """Ranking de cliques + onde o clique cai dentro do elemento (heatmap)."""
        result = await self.session.execute(
            select(
                SiteEvent.target,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
                func.avg(SiteEvent.pos_x).label("pos_x"),
                func.avg(SiteEvent.pos_y).label("pos_y"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.CLICK)
            .group_by(SiteEvent.target, SiteEvent.site)
        )
        ctas: dict[str, dict] = {}
        for row in result:
            label = row.target or "(sem rótulo)"
            item = ctas.setdefault(
                label,
                {"count": 0, "pos_x": 0.0, "pos_y": 0.0, "by_site": {}},
            )
            count = int(row.count or 0)
            item["count"] += count
            item["pos_x"] += float(row.pos_x or 0) * count
            item["pos_y"] += float(row.pos_y or 0) * count
            site = str(row.site)
            item["by_site"][site] = item["by_site"].get(site, 0) + count
        ranked = sorted(ctas.items(), key=lambda item: item[1]["count"], reverse=True)[
            :limit
        ]
        return [
            {
                "label": label,
                "count": item["count"],
                "pos_x": round(item["pos_x"] / item["count"]),
                "pos_y": round(item["pos_y"] / item["count"]),
                "by_site": _site_breakdown(item["by_site"]),
            }
            for label, item in ranked
        ]

    async def whatsapp_clicks(self, filters: list, limit: int = 15) -> list[dict]:
        """Cliques no WhatsApp por origem (lista, cotacao, bairro, produto, flutuante)."""
        result = await self.session.execute(
            select(
                SiteEvent.target,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.WHATSAPP_CLICK)
            .group_by(SiteEvent.target, SiteEvent.site)
        )
        data: dict[str, dict] = {}
        for row in result:
            label = row.target or "(sem rótulo)"
            item = data.setdefault(label, {"count": 0, "by_site": {}})
            count = int(row.count or 0)
            item["count"] += count
            site = str(row.site)
            item["by_site"][site] = item["by_site"].get(site, 0) + count
        ranked = sorted(data.items(), key=lambda item: item[1]["count"], reverse=True)[:limit]
        return [
            {
                "label": label,
                "count": item["count"],
                "pos_x": None,
                "pos_y": None,
                "by_site": _site_breakdown(item["by_site"]),
            }
            for label, item in ranked
        ]

    async def top_lista_products(self, filters: list, limit: int = 15) -> list[dict]:
        """Produtos mais adicionados à lista."""
        result = await self.session.execute(
            select(
                SiteEvent.target,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.LISTA_ADD)
            .group_by(SiteEvent.target, SiteEvent.site)
        )
        data: dict[str, dict] = {}
        for row in result:
            label = row.target or "(sem rótulo)"
            item = data.setdefault(label, {"count": 0, "by_site": {}})
            count = int(row.count or 0)
            item["count"] += count
            site = str(row.site)
            item["by_site"][site] = item["by_site"].get(site, 0) + count
        ranked = sorted(data.items(), key=lambda item: item[1]["count"], reverse=True)[:limit]
        return [
            {
                "label": label,
                "count": item["count"],
                "pos_x": None,
                "pos_y": None,
                "by_site": _site_breakdown(item["by_site"]),
            }
            for label, item in ranked
        ]

    async def top_search_terms(self, filters: list, limit: int = 15) -> list[dict]:
        """Termos mais pesquisados na busca do catálogo."""
        result = await self.session.execute(
            select(
                SiteEvent.target,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.BUSCA)
            .group_by(SiteEvent.target, SiteEvent.site)
        )
        data: dict[str, dict] = {}
        for row in result:
            label = row.target or "(sem rótulo)"
            item = data.setdefault(label, {"count": 0, "by_site": {}})
            count = int(row.count or 0)
            item["count"] += count
            site = str(row.site)
            item["by_site"][site] = item["by_site"].get(site, 0) + count
        ranked = sorted(data.items(), key=lambda item: item[1]["count"], reverse=True)[:limit]
        return [
            {
                "label": label,
                "count": item["count"],
                "pos_x": None,
                "pos_y": None,
                "by_site": _site_breakdown(item["by_site"]),
            }
            for label, item in ranked
        ]

    async def promotions_summary(self, filters: list, limit: int = 15) -> list[dict]:
        """Desempenho de promoções de entrada (popup_view, popup_click, popup_close)."""
        result = await self.session.execute(
            select(
                SiteEvent.event,
                SiteEvent.target,
                SiteEvent.site,
                func.count(SiteEvent.id).label("count"),
            )
            .where(*filters, SiteEvent.event.in_([
                SiteEventType.POPUP_VIEW,
                SiteEventType.POPUP_CLICK,
                SiteEventType.POPUP_CLOSE,
            ]))
            .group_by(SiteEvent.event, SiteEvent.target, SiteEvent.site)
        )
        data: dict[str, dict] = {}
        for row in result:
            action = str(row.event).replace("popup_", "")
            promo = row.target or "(sem id)"
            label = f"{promo} · {action}"
            item = data.setdefault(label, {"count": 0, "by_site": {}})
            count = int(row.count or 0)
            item["count"] += count
            site = str(row.site)
            item["by_site"][site] = item["by_site"].get(site, 0) + count
        ranked = sorted(data.items(), key=lambda item: item[1]["count"], reverse=True)[:limit]
        return [
            {
                "label": label,
                "count": item["count"],
                "pos_x": None,
                "pos_y": None,
                "by_site": _site_breakdown(item["by_site"]),
            }
            for label, item in ranked
        ]

    async def sources(
        self,
        filters: list,
        limit: int = 10,
        campaign_links: dict[str, CampaignSourceLink] | list[CampaignSourceLink] | None = None,
    ) -> list[dict]:
        """Atribuicao da primeira pageview de cada sessao."""
        by_id: dict[str, CampaignSourceLink] = {}
        all_links: list[CampaignSourceLink] = []
        if isinstance(campaign_links, dict):
            by_id = campaign_links
            all_links = list(campaign_links.values())
        elif isinstance(campaign_links, list):
            by_id = {link.identifier: link for link in campaign_links}
            all_links = campaign_links

        occurred_at = func.coalesce(SiteEvent.occurred_at, SiteEvent.created_at)
        first_pageviews = (
            select(
                SiteEvent.site.label("site"),
                SiteEvent.session_id.label("session_id"),
                SiteEvent.utm_source.label("utm_source"),
                SiteEvent.utm_medium.label("utm_medium"),
                SiteEvent.utm_campaign.label("utm_campaign"),
                SiteEvent.utm_content.label("utm_content"),
                SiteEvent.placement.label("placement"),
                SiteEvent.referrer.label("referrer"),
                func.row_number()
                .over(
                    partition_by=(SiteEvent.site, SiteEvent.session_id),
                    order_by=(occurred_at.asc(), SiteEvent.id.asc()),
                )
                .label("pageview_rank"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.PAGEVIEW)
            .subquery()
        )
        result = await self.session.execute(
            select(
                first_pageviews.c.utm_source,
                first_pageviews.c.utm_medium,
                first_pageviews.c.utm_campaign,
                first_pageviews.c.utm_content,
                first_pageviews.c.placement,
                first_pageviews.c.referrer,
                first_pageviews.c.site,
                func.count(func.distinct(first_pageviews.c.session_id)).label("count"),
            )
            .where(first_pageviews.c.pageview_rank == 1)
            .group_by(
                first_pageviews.c.utm_source,
                first_pageviews.c.utm_medium,
                first_pageviews.c.utm_campaign,
                first_pageviews.c.utm_content,
                first_pageviews.c.placement,
                first_pageviews.c.referrer,
                first_pageviews.c.site,
            )
        )
        merged: dict[tuple[str, str, str], dict] = {}
        for row in result:
            utm_source = (row.utm_source or "").strip()
            utm_medium = (row.utm_medium or "").strip()
            referrer_host = _referrer_host(row.referrer)
            raw_label = utm_source or referrer_host or "Direto"
            source_key = _canonical_source(utm_source)
            medium_key = _canonical_medium(utm_medium)
            key = (
                source_key,
                medium_key if utm_source else "",
                referrer_host if not utm_source else "",
            )
            item = merged.setdefault(
                key,
                {
                    "label": _source_row_label(utm_source, utm_medium, referrer_host),
                    "sites": {},
                    "raw": {},
                    "campaigns": {},
                },
            )
            site_counts = item["sites"]
            site = str(row.site)
            count = int(row.count or 0)
            site_counts[site] = site_counts.get(site, 0) + count
            raw_counts = item["raw"]
            raw_counts[raw_label] = raw_counts.get(raw_label, 0) + count

            campaign_raw = (row.utm_campaign or "").strip()
            campaign_key = _campaign_group_key(campaign_raw)
            campaign_label = _campaign_display_label(campaign_raw)
            campaign = item["campaigns"].setdefault(
                campaign_key,
                {"label": campaign_label, "count": 0, "creatives": {}},
            )
            campaign["label"] = _prefer_campaign_label(
                campaign["label"], campaign_label
            )
            campaign["count"] += count
            content = (row.utm_content or "").strip()
            creative_label = content or "(sem criativo)"
            creative_key = (creative_label, (row.placement or "").strip())
            matched_link = by_id.get(content) if content else None
            if matched_link is None and row.referrer:
                norm_ref = _normalize_redirect_match(row.referrer)
                if norm_ref:
                    for link in all_links:
                        if not link.redirect_url:
                            continue
                        norm_link = _normalize_redirect_match(link.redirect_url)
                        if (
                            norm_link == norm_ref
                            or ("/" not in norm_ref and norm_link.split("/")[0] == norm_ref)
                            or ("/" not in norm_link and norm_ref.split("/")[0] == norm_link)
                        ):
                            matched_link = link
                            break

            creative = campaign["creatives"].setdefault(
                creative_key,
                {
                    "label": creative_label,
                    "count": 0,
                    "placement": (row.placement or "").strip(),
                    "link": _campaign_link_payload(matched_link),
                },
            )
            if creative["link"] is None and matched_link is not None:
                creative["link"] = _campaign_link_payload(matched_link)
            creative["count"] += count
        ranked = sorted(
            merged.items(),
            key=lambda item: sum(item[1]["sites"].values()),
            reverse=True,
        )[:limit]
        return [
            {
                "label": item["label"],
                "count": sum(item["sites"].values()),
                "by_site": _site_breakdown(item["sites"]),
                "raw_labels": _raw_label_breakdown(item["raw"]),
                "campaigns": [
                    {
                        "label": campaign["label"],
                        "count": campaign["count"],
                        "creatives": sorted(
                            campaign["creatives"].values(),
                            key=lambda creative: (-creative["count"], creative["label"]),
                        ),
                    }
                    for _, campaign in sorted(
                        item["campaigns"].items(),
                        key=lambda entry: (-entry[1]["count"], entry[1]["label"]),
                    )
                ],
            }
            for _, item in ranked
        ]

    async def devices(self, filters: list) -> list[dict]:
        result = await self.session.execute(
            select(
                SiteEvent.device,
                SiteEvent.site,
                func.count(func.distinct(SiteEvent.session_id)).label("count"),
            )
            .where(*filters, SiteEvent.event == SiteEventType.PAGEVIEW)
            .group_by(SiteEvent.device, SiteEvent.site)
        )
        devices: dict[str, dict[str, dict[str, int]]] = {}
        for row in result:
            raw_label = (row.device or "desconhecido").strip()
            label = _device_label(raw_label)
            item = devices.setdefault(label, {"sites": {}, "raw": {}})
            site_counts = item["sites"]
            site = str(row.site)
            site_counts[site] = site_counts.get(site, 0) + int(row.count)
            raw_counts = item["raw"]
            raw_counts[raw_label] = raw_counts.get(raw_label, 0) + int(row.count)
        ranked = sorted(
            devices.items(),
            key=lambda item: sum(item[1]["sites"].values()),
            reverse=True,
        )
        return [
            {
                "label": label,
                "count": sum(item["sites"].values()),
                "by_site": _site_breakdown(item["sites"]),
                "raw_labels": _raw_label_breakdown(item["raw"]),
            }
            for label, item in ranked
        ]


def _referrer_host(referrer: str) -> str:
    """`https://www.google.com/x` -> `google.com`; vazio quando nao da."""
    if not referrer:
        return ""
    host = referrer.split("//")[-1].split("/")[0]
    return host[4:] if host.startswith("www.") else host


def _normalize_redirect_match(url: str) -> str:
    raw = (url or "").strip().lower()
    if not raw:
        return ""
    if "://" in raw:
        raw = raw.split("://", 1)[1]
    if raw.startswith("www."):
        raw = raw[4:]
    return raw.split("?", 1)[0].split("#", 1)[0].rstrip("/")


def _source_label(raw_label: str) -> str:
    normalized = raw_label.lower()
    if normalized == "instagram.com":
        return "Instagram · Web"
    if normalized == "m.instagram.com":
        return "Instagram · Web móvel"
    if normalized == "l.instagram.com":
        return "Instagram · Redirecionador de link"
    if normalized in {"com.instagram.android", "instagram.android"}:
        return "Instagram · Android"
    if normalized in {"com.instagram.ios", "instagram.ios"}:
        return "Instagram · iOS"
    if normalized == "facebook.com":
        return "Facebook · Web"
    if normalized == "l.facebook.com":
        return "Facebook · Redirecionador de link"
    if normalized == "m.facebook.com":
        return "Facebook · Web móvel"
    if normalized in {"com.facebook.katana", "facebook.android"}:
        return "Facebook · Android"
    if normalized in {"com.linkedin.android", "linkedin.android"}:
        return "LinkedIn · Android"
    if normalized in {"com.linkedin.ios", "linkedin.ios"}:
        return "LinkedIn · iOS"
    if normalized == "linkedin.com":
        return "LinkedIn · Web"
    if normalized.startswith("google."):
        return "Google · Web"
    if normalized == "web.whatsapp.com":
        return "WhatsApp · Web"
    if normalized == "l.whatsapp.com":
        return "WhatsApp · Redirecionador de link"
    return raw_label or "Direto"


_NO_MEDIUM_LABEL = "n\u00e3o informado"


def _canonical_source(raw: str) -> str:
    normalized = raw.strip().lower()
    return _SOURCE_ALIASES.get(normalized, normalized)


def _canonical_medium(raw: str) -> str:
    normalized = raw.strip().lower()
    return _MEDIUM_ALIASES.get(normalized, normalized)


def _source_display_label(raw: str) -> str:
    normalized = _canonical_source(raw)
    return _SOURCE_LABELS.get(normalized, raw)


def _medium_display_label(raw: str) -> str:
    normalized = _canonical_medium(raw)
    return _MEDIUM_LABELS.get(normalized, raw)


def _source_row_label(source: str, medium: str, referrer_host: str) -> str:
    if source:
        source_label = _source_display_label(source)
        medium_label = _medium_display_label(medium) if medium else _NO_MEDIUM_LABEL
        return f"{source_label} / {medium_label}"
    return _source_label(referrer_host or "Direto")


def _decode_tracking_label(raw: str) -> str:
    """Decodifica no maximo duas camadas de query string sem tocar no evento bruto."""
    value = raw.strip()
    for _ in range(2):
        decoded = unquote_plus(value)
        if decoded == value:
            break
        value = decoded
    return " ".join(value.split())


def _campaign_display_label(raw: str) -> str:
    value = _decode_tracking_label(raw)
    if not value:
        return _CAMPAIGN_NONE
    if _CAMPAIGN_ID.fullmatch(value):
        return f"ID da campanha \u00b7 {value}"
    return value


def _campaign_group_key(raw: str) -> str:
    value = _decode_tracking_label(raw)
    if not value:
        return _CAMPAIGN_NONE
    if _CAMPAIGN_ID.fullmatch(value):
        return f"id:{value}"
    normalized = unicodedata.normalize("NFD", value).lower()
    normalized = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized or value.casefold()


def _prefer_campaign_label(current: str, candidate: str) -> str:
    """Prefere o nome decodificado legivel ao slug da mesma campanha."""
    if current == candidate:
        return current
    if current.startswith("ID da campanha"):
        return current
    if candidate.startswith("ID da campanha"):
        return candidate
    if len(candidate.split()) > len(current.split()):
        return candidate
    return current


def _campaign_link_payload(link: CampaignSourceLink | None) -> dict[str, str] | None:
    if link is None:
        return None
    return {
        "identifier": link.identifier,
        "title": link.title,
        "source_url": link.source_url,
        "thumbnail_url": link.thumbnail_url,
        "redirect_url": link.redirect_url,
    }


def _device_label(raw_label: str) -> str:
    return {
        "mobile": "Celular",
        "desktop": "Computador",
        "tablet": "Tablet",
        "desconhecido": "Desconhecido",
    }.get(raw_label.lower(), raw_label or "Desconhecido")


def _raw_label_breakdown(counts: dict[str, int]) -> list[dict[str, int | str]]:
    return [
        {"label": label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _site_breakdown(counts: dict[str, int]) -> list[dict]:
    order = {str(site): index for index, site in enumerate(SiteScope)}
    return [
        {"site": site, "count": count}
        for site, count in sorted(
            counts.items(),
            key=lambda item: order.get(item[0], len(order)),
        )
        if count > 0
    ]


def _daily_payload(events: list[SiteEvent]) -> dict[str, object]:
    """Reduz eventos de um site/dia a contadores sem identificadores."""
    pageview_sessions = {
        event.session_id for event in events if event.event == SiteEventType.PAGEVIEW
    }
    engaged_sessions = {
        event.session_id for event in events if event.event in _ENGAGED_EVENTS
    }
    funnel = {
        step.value: len({event.session_id for event in events if event.event == step})
        for step, _, _ in FUNNEL_STEPS
    }
    pages: dict[str, int] = {}
    sources: dict[str, set[str]] = {}
    devices: dict[str, set[str]] = {}
    ctas: dict[str, dict[str, int]] = {}
    for event in events:
        if event.event == SiteEventType.PAGEVIEW:
            page = event.page or "/"
            pages[page] = pages.get(page, 0) + 1
            source = event.utm_source or event.referrer or "direct"
            sources.setdefault(source, set()).add(event.session_id)
            device = event.device or "desconhecido"
            devices.setdefault(device, set()).add(event.session_id)
        elif event.event == SiteEventType.CLICK:
            target = event.target or "(sem rótulo)"
            item = ctas.setdefault(
                target, {"count": 0, "pos_x_total": 0, "pos_y_total": 0}
            )
            item["count"] += 1
            item["pos_x_total"] += event.pos_x
            item["pos_y_total"] += event.pos_y

    return {
        "overview": {
            "visitors": len(pageview_sessions),
            "pageviews": sum(
                1 for event in events if event.event == SiteEventType.PAGEVIEW
            ),
            "clicks": sum(1 for event in events if event.event == SiteEventType.CLICK),
            "form_submits": sum(
                1 for event in events if event.event == SiteEventType.FORM_SUBMIT
            ),
            "engaged_visitors": len(engaged_sessions),
        },
        "funnel": funnel,
        "pages": [
            {"label": label, "count": count}
            for label, count in sorted(
                pages.items(), key=lambda item: (-item[1], item[0])
            )
        ],
        "ctas": [
            {"label": label, **values}
            for label, values in sorted(
                ctas.items(), key=lambda item: (-item[1]["count"], item[0])
            )
        ],
        "sources": [
            {"label": label, "count": len(sessions)}
            for label, sessions in sorted(
                sources.items(), key=lambda item: (-len(item[1]), item[0])
            )
        ],
        "devices": [
            {"label": label, "count": len(sessions)}
            for label, sessions in sorted(
                devices.items(), key=lambda item: (-len(item[1]), item[0])
            )
        ],
    }


def _merge_daily_payload(
    existing: dict[str, object], incoming: dict[str, object]
) -> dict[str, object]:
    """Soma dois snapshots do mesmo site/dia, sem reintroduzir detalhe bruto."""
    result = dict(existing)
    overview = dict(existing.get("overview", {}))
    for key, value in dict(incoming.get("overview", {})).items():
        overview[key] = int(overview.get(key, 0)) + int(value)
    result["overview"] = overview

    funnel = dict(existing.get("funnel", {}))
    for key, value in dict(incoming.get("funnel", {})).items():
        funnel[key] = int(funnel.get(key, 0)) + int(value)
    result["funnel"] = funnel

    for key, counter_keys in (
        ("pages", ("count",)),
        ("sources", ("count",)),
        ("devices", ("count",)),
        ("ctas", ("count", "pos_x_total", "pos_y_total")),
    ):
        merged: dict[str, dict[str, int | str]] = {
            str(item["label"]): dict(item)
            for item in list(existing.get(key, []))
            if isinstance(item, dict) and "label" in item
        }
        for item in list(incoming.get(key, [])):
            if not isinstance(item, dict) or "label" not in item:
                continue
            label = str(item["label"])
            current = merged.setdefault(label, {"label": label})
            for counter_key in counter_keys:
                current[counter_key] = int(current.get(counter_key, 0)) + int(
                    item.get(counter_key, 0)
                )
        result[key] = sorted(
            merged.values(), key=lambda item: (-int(item["count"]), str(item["label"]))
        )
    return result
