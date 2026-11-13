import type { AnalyticsChannel, AnalyticsFunnelStep, AnalyticsOverview, AnalyticsPoint } from "../../types/cms.types";
import styles from "./CmsAnalyticsPage.module.css";
import {
  chartPath,
  displayFunnel,
  formatDate,
  formatDuration,
  formatNumber,
  funnelChrome,
  sparkPoints,
  overviewRows,
  siteCountRows,
  sitePairRows,
} from "./CmsAnalyticsPage.utils";
import { ChannelTip, SplitPairTip } from "./CmsAnalyticsTips";

interface TrafficChartProps {
  points: AnalyticsPoint[];
  metric: "visitors" | "pageviews";
  onMetric: (metric: "visitors" | "pageviews") => void;
}

export function TrafficChart({ points, metric, onMetric }: Readonly<TrafficChartProps>) {
  if (!points.length) return <p className={styles.empty}>Ainda não há dados para este período.</p>;
  const other = metric === "visitors" ? "pageviews" : "visitors";
  const top = Math.ceil(Math.max(...points.map((point) => point[metric]), 1) / 100) * 100 || 100;
  const maxOther = Math.max(...points.map((point) => point[other]), 1);
  const line = chartPath(points, metric, top);
  const total = points.reduce((sum, point) => sum + point[metric], 0);
  return (
    <section className={styles.card} aria-label="Série do período">
      <div className={styles.heroHead}>
        <div>
          <div className={styles.heroLabel}>{metric === "visitors" ? "Visitantes no período" : "Visualizações no período"}</div>
          <div className={styles.heroValue}>
            <strong>{formatNumber(total)}</strong>
            <span>no período · {formatNumber(total / points.length)} por dia</span>
          </div>
        </div>
        <div className={`${styles.pills} ${styles.metricPills}`}>
          <button type="button" className={styles.pill} data-active={metric === "visitors"} onClick={() => onMetric("visitors")}>Visitantes</button>
          <button type="button" className={styles.pill} data-active={metric === "pageviews"} onClick={() => onMetric("pageviews")}>Visualizações</button>
        </div>
      </div>
      <div className={styles.chartGrid}>
        <div className={styles.chartTicks}>{[1, 0.75, 0.5, 0.25, 0].map((factor) => <span key={factor}>{formatNumber(top * factor)}</span>)}</div>
        <div className={styles.chartPlot}>
          <svg viewBox="0 0 600 230" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="uniArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4e22" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ec4e22" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="currentColor" strokeWidth="1" opacity="0.10">
              <line x1="0" y1="0.5" x2="600" y2="0.5" /><line x1="0" y1="57.5" x2="600" y2="57.5" />
              <line x1="0" y1="115" x2="600" y2="115" /><line x1="0" y1="172.5" x2="600" y2="172.5" /><line x1="0" y1="229.5" x2="600" y2="229.5" />
            </g>
            <path d={`${line} L600 230 L0 230 Z`} fill="url(#uniArea)" />
            <path d={chartPath(points, other, maxOther * 1.05)} fill="none" stroke="#05a2f2" strokeWidth="1.3" strokeDasharray="3 3" opacity="0.7" />
            <path d={line} fill="none" stroke="#ec4e22" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className={styles.hoverRow}>
            {points.map((point) => (
              <div key={point.day} className={styles.hoverCell} data-tip>
                <span className={styles.hoverLine} />
                <span className={styles.hoverDot} style={{ top: `${((230 - (point[metric] / top) * 222) / 230) * 100}%` }} />
                <div className={styles.tip} style={{ bottom: "calc(100% - 205px)", minWidth: 196 }}>
                  <div className={styles.tipTitle}>{formatDate(point.day)}</div>
                  <div className={styles.tipPair}>
                    <span><strong>{formatNumber(point.visitors)}</strong><em>visitantes</em></span>
                    <span><strong className={styles.tipViews}>{formatNumber(point.pageviews)}</strong><em>views</em></span>
                  </div>
                  <div className={styles.tipRule} />
                  <SplitPairTip rows={sitePairRows(point.bySite)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className={styles.chartAxis}>
          {[0, 0.25, 0.5, 0.75, 1].map((factor) => {
            const point = points[Math.min(points.length - 1, Math.round(factor * (points.length - 1)))];
            return <span key={factor}>{point ? formatDate(point.day).slice(0, 5) : ""}</span>;
          })}
        </div>
      </div>
    </section>
  );
}

export function KpiRail({ overview, points, channels }: { overview: AnalyticsOverview; points: AnalyticsPoint[]; channels: AnalyticsChannel[] }) {
  const kpis = [
    { label: "Visitantes", value: formatNumber(overview.visitors), hint: "sessões únicas", spark: sparkPoints(points, "visitors"), color: "#ec4e22", split: overviewRows(channels, "visitors") },
    { label: "Visualizações", value: formatNumber(overview.pageviews), hint: "", spark: sparkPoints(points, "pageviews"), color: "#05a2f2", split: overviewRows(channels, "pageviews") },
    { label: "Permanência", value: formatDuration(overview.medianDwellMs), hint: "mediana visível", spark: "", color: "", split: [] as ReturnType<typeof overviewRows> },
    { label: "Cliques", value: formatNumber(overview.clicks), hint: "", spark: "", color: "", split: overviewRows(channels, "clicks") },
    { label: "Formulários", value: formatNumber(overview.formSubmits), hint: "enviados", spark: "", color: "", split: overviewRows(channels, "formSubmits") },
    { label: "Rejeição", value: `${overview.bounceRate.toFixed(1).replace(".", ",")}%`, hint: "saiu sem interagir", spark: "", color: "", split: [] },
  ];
  return (
    <section className={styles.kpis} aria-label="Indicadores do período">
      {kpis.map((kpi) => (
        <article key={kpi.label} className={`${styles.kpi} ${styles.tipHost}`}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.kpiLabel}>{kpi.label}</div>
            <div className={styles.kpiValue}><strong>{kpi.value}</strong>{kpi.hint ? <span>{kpi.hint}</span> : null}</div>
          </div>
          {kpi.spark ? <svg viewBox="0 0 100 26" preserveAspectRatio="none" className={styles.spark}><polyline points={kpi.spark} fill="none" stroke={kpi.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg> : null}
          {kpi.split.length ? <div className={styles.tip}><div className={styles.tipTitle}>{kpi.label} por canal</div><ChannelTip rows={kpi.split} /></div> : null}
        </article>
      ))}
    </section>
  );
}

export function FunnelSection({ rows }: { rows: AnalyticsFunnelStep[] }) {
  const steps = displayFunnel(rows);
  if (!steps.length) return null;
  return (
    <section className={styles.card} aria-label="Funil do período">
      <div className={styles.funnelHead}><h2>Funil do período</h2><span>passe o mouse para a composição por canal</span></div>
      <div className={styles.funnelBlocks}>
        {steps.map((row, index) => {
          const chrome = funnelChrome(index, index === steps.length - 1);
          const drop = index === 0 ? "entrada do funil" : `−${formatNumber(steps[index - 1].sessions - row.sessions)} vs. etapa anterior`;
          return (
            <div key={row.step} className={`${styles.funnelStep} ${styles.tipHost}`}>
              <div className={styles.funnelStepTop}><span>{row.label}</span><em>{row.rate.toFixed(1).replace(".", ",")}%</em></div>
              <div className={styles.funnelBlock} style={{ background: chrome.block, clipPath: chrome.clip }}>
                <strong>{formatNumber(row.sessions)}</strong><span>{drop}</span>
              </div>
              <div className={styles.tip}>
                <div className={styles.tipTitle}>{row.label}</div>
                <ChannelTip rows={siteCountRows(row.bySite)} />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.funnelBars}>
        <span>Proporção sobre a entrada</span>
        {steps.map((row, index) => {
          const drop = index === 0 ? "entrada do funil" : `−${formatNumber(steps[index - 1].sessions - row.sessions)} vs. etapa anterior`;
          return (
            <div key={`${row.step}-bar`} className={`${styles.funnelBar} ${styles.tipHost}`}>
              <div className={styles.barLabel}>
                <span>{row.label}</span>
                <span><strong>{formatNumber(row.sessions)}</strong><em>{row.rate.toFixed(1).replace(".", ",")}%</em></span>
              </div>
              <div className={styles.track}><i style={{ width: `${Math.max(6, row.rate)}%`, background: `linear-gradient(90deg,#031a2b,${funnelChrome(index, true).bar})` }} /></div>
              <div className={styles.tip} style={{ minWidth: 190 }}>
                <div className={styles.tipRow}><span>{row.label}</span><strong>{formatNumber(row.sessions)}</strong></div>
                <div className={styles.tipHint}>{drop}</div>
                <div className={styles.tipRule} />
                <ChannelTip rows={siteCountRows(row.bySite)} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
