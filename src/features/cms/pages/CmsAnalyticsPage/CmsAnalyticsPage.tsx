import { useMemo, useState } from "react";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsShell } from "../../components/CmsShell";
import { AnalyticsPagesTable } from "../../components/AnalyticsPagesTable/AnalyticsPagesTable";
import { useCmsAnalytics } from "../../hooks/useCmsAnalytics";
import { useCmsAnalyticsPages } from "../../hooks/useCmsAnalyticsPages";
import type { ContactSiteScope } from "../../types/cms.types";
import { FunnelSection, KpiRail, TrafficChart } from "./CmsAnalyticsCharts";
import { CompositionCard, CtaCard, PagesCard, RankingCard, WeeklyCard } from "./CmsAnalyticsPanels";
import styles from "./CmsAnalyticsPage.module.css";
import { PERIOD_FILTERS, formatPeriod, rangeFor, type PeriodKey } from "./CmsAnalyticsPage.utils";

export function CmsAnalyticsPage() {
  return <CmsAuthGuard><CmsAnalyticsView /></CmsAuthGuard>;
}

function CmsAnalyticsView() {
  const site: ContactSiteScope = "falcao";
  const [preset, setPreset] = useState<PeriodKey>("30d");
  const [customPeriod, setCustomPeriod] = useState(() => rangeFor("30d"));
  const [metric, setMetric] = useState<"visitors" | "pageviews">("visitors");
  const [pagesPage, setPagesPage] = useState(1);
  const period = useMemo(() => preset === "custom" ? customPeriod : rangeFor(preset), [customPeriod, preset]);
  const { dashboard, isLoading, errorMessage } = useCmsAnalytics(site, period);
  const pages = useCmsAnalyticsPages(site, period, pagesPage, 20);
  const dayCount = dashboard.timeseries.length || 1;

  return (
    <CmsShell title="Métricas" crumb="Métricas" searchPlaceholder="Buscar página ou CTA">
      <main className={styles.page}>
        <section className={styles.filters} aria-label="Filtros de métricas">
          <div className={styles.pills}>
            {PERIOD_FILTERS.map((option) => (
              <button key={option.key} type="button" className={styles.pill} data-active={preset === option.key} onClick={() => { setPreset(option.key); setPagesPage(1); }}>{option.label}</button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className={styles.customDates}>
              <input type="date" aria-label="Data inicial" value={customPeriod.from} onChange={(event) => { setCustomPeriod((current) => ({ ...current, from: event.target.value })); setPagesPage(1); }} />
              <span>→</span>
              <input type="date" aria-label="Data final" value={customPeriod.to} onChange={(event) => { setCustomPeriod((current) => ({ ...current, to: event.target.value })); setPagesPage(1); }} />
            </div>
          ) : null}
          <span className={styles.periodMeta}>{formatPeriod(period.from, period.to)}<em>{dayCount} dias</em></span>
        </section>
        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        <section className={styles.heroGrid}>
          <TrafficChart points={dashboard.timeseries} metric={metric} onMetric={setMetric} />
          <KpiRail overview={dashboard.overview} points={dashboard.timeseries} channels={dashboard.channels} />
        </section>
        <FunnelSection rows={dashboard.funnel} />
        <section className={styles.detailsGrid}>
          <PagesCard rows={dashboard.topPages} />
          <CtaCard rows={dashboard.topCtas} />
        </section>
        <section className={styles.rankingGrid}>
          <RankingCard title="Cliques no WhatsApp" unit="cliques" rows={dashboard.whatsappClicks ?? []} />
          <RankingCard title="Produtos mais adicionados à Lista" unit="adições" rows={dashboard.topListaProducts ?? []} />
        </section>
        <section className={styles.rankingGrid}>
          <RankingCard title="Termos mais buscados" unit="buscas" rows={dashboard.topSearchTerms ?? []} />
          <RankingCard title="Promoções de entrada" unit="eventos" rows={dashboard.promotionsSummary ?? []} />
        </section>
        <AnalyticsPagesTable pages={pages.pages} isLoading={pages.isLoading} isFetching={pages.isFetching} errorMessage={pages.errorMessage} onPageChange={setPagesPage} />
        <section className={styles.rankingGrid}>
          <RankingCard title="Origens de tráfego" unit="sessões" rows={dashboard.sources} showCampaigns />
          <RankingCard title="Dispositivos" unit="sessões" rows={dashboard.devices} />
        </section>
        <section className={styles.bottomGrid}>
          <WeeklyCard points={dashboard.timeseries} pagesPerSession={dashboard.pagesPerSession} />
          <CompositionCard channels={dashboard.channels.map((channel) => ({ site: channel.site, visitors: channel.overview.visitors }))} sources={dashboard.sources} devices={dashboard.devices} />
        </section>
        {isLoading ? <p className={styles.loading}>Atualizando métricas...</p> : null}
      </main>
    </CmsShell>
  );
}
