import type {
  AnalyticsChannel,
  AnalyticsFunnelStep,
  AnalyticsPoint,
  AnalyticsPointSite,
  AnalyticsSiteCount,
  ContactSiteScope,
} from "../../types/cms.types";

export const CHANNEL_META: Record<ContactSiteScope, { label: string; short: string; color: string }> = {
  falcao: { label: "Falcão Limpeza", short: "Falcão", color: "#1B3FA0" },
  talimpo: { label: "Falcão Limpeza", short: "Falcão", color: "#1B3FA0" },
};

export function formatPageLabel(path: string): string {
  if (!path || path === "/") return "Início (Home)";
  if (path.startsWith("/guias/")) return `Guia: ${path.replace(/^\/guias\//, "")}`;
  if (path === "/guias") return "Guias de Defesa";
  if (path.startsWith("/artigos/")) return `Artigo: ${path.replace(/^\/artigos\//, "")}`;
  if (path === "/artigos") return "Artigos";
  if (path.startsWith("/cases/")) return `Guia: ${path.replace(/^\/cases\//, "")}`;
  return path;
}

export type PeriodKey = "today" | "7d" | "30d" | "90d" | "month" | "custom";

export const PERIOD_FILTERS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "month", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FUNNEL_BLOCKS = [
  "linear-gradient(135deg,#031a2b,#02578a)",
  "linear-gradient(135deg,#02578a,#0d84c0)",
  "linear-gradient(135deg,#d55b1b,#ec4e22)",
  "linear-gradient(135deg,#ec4e22,#fd9800)",
];
const FUNNEL_BARS = ["#02578a", "#0d6fa8", "#d55b1b", "#ec4e22"];
const SHARE_COLORS = ["#ec4e22", "#05a2f2", "#fd9800", "#02578a"];

export function toInputDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function rangeFor(key: Exclude<PeriodKey, "custom">) {
  const end = new Date();
  const start = new Date();
  if (key === "today") {
    return { from: toInputDate(end), to: toInputDate(end) };
  }
  if (key === "month") {
    start.setDate(1);
    return { from: toInputDate(start), to: toInputDate(end) };
  }
  const days = key === "7d" ? 7 : key === "90d" ? 90 : 30;
  start.setDate(start.getDate() - (days - 1));
  return { from: toInputDate(start), to: toInputDate(end) };
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

export function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1_000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

export function formatDay(day: string) {
  const [, month, date] = day.split("-");
  return month && date ? `${date}/${month}` : "";
}

export function formatDate(day: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${day}T12:00:00`));
}

export function formatPeriod(from: string, to: string) {
  return `${formatDate(from)} – ${formatDate(to)}`;
}

const FUNNEL_DISPLAY = [
  { step: "pageview", label: "Sessões" },
  { step: "case_view", label: "Viu um guia de defesa" },
  { step: "click", label: "Clicou em CTA" },
  { step: "form_submit", label: "Enviou formulário" },
] as const;

export function siteCountRows(counts: AnalyticsSiteCount[] = []) {
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  return counts
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: CHANNEL_META[item.site].short,
      value: formatNumber(item.count),
      pct: `${((item.count / total) * 100).toFixed(0)}%`,
      color: CHANNEL_META[item.site].color,
    }));
}

export function sitePairRows(counts: AnalyticsPointSite[] = []) {
  return counts
    .filter((item) => item.visitors > 0 || item.pageviews > 0)
    .map((item) => ({
      label: CHANNEL_META[item.site].short,
      a: formatNumber(item.visitors),
      b: formatNumber(item.pageviews),
      color: CHANNEL_META[item.site].color,
    }));
}

export function overviewRows(
  channels: AnalyticsChannel[],
  metric: "visitors" | "pageviews" | "clicks" | "formSubmits",
) {
  const counts = channels.map((channel) => ({ site: channel.site, count: channel.overview[metric] }));
  return siteCountRows(counts);
}

export function stackSiteCounts(counts: AnalyticsSiteCount[] = []) {
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  return counts
    .filter((item) => item.count > 0)
    .map((item) => ({
      label: CHANNEL_META[item.site].short,
      width: (item.count / total) * 100,
      color: CHANNEL_META[item.site].color,
    }));
}

export function displayFunnel(rows: AnalyticsFunnelStep[]) {
  return FUNNEL_DISPLAY.flatMap((wanted) => {
    const row = rows.find((item) => item.step === wanted.step);
    return row ? [{ ...row, label: wanted.label }] : [];
  });
}

export function sparkPoints(points: AnalyticsPoint[], key: "visitors" | "pageviews") {
  const max = Math.max(...points.map((point) => point[key]), 1);
  return points.map((point, index) => `${((index / Math.max(points.length - 1, 1)) * 100).toFixed(1)},${(25 - (point[key] / max) * 22).toFixed(1)}`).join(" ");
}

export function chartPath(points: AnalyticsPoint[], key: "visitors" | "pageviews", max: number, height = 230) {
  if (!points.length) return "";
  return points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 600;
    const y = height - (point[key] / Math.max(max, 1)) * (height - 8);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function weeklyFromSeries(points: AnalyticsPoint[]) {
  const buckets = DAY_NAMES.map(() => ({
    visitors: 0,
    pageviews: 0,
    days: 0,
    bySite: new Map<ContactSiteScope, { visitors: number; pageviews: number }>(),
  }));
  for (const point of points) {
    const bucket = buckets[new Date(`${point.day}T12:00:00`).getDay()];
    bucket.visitors += point.visitors;
    bucket.pageviews += point.pageviews;
    bucket.days += 1;
    for (const site of point.bySite ?? []) {
      const aggregate = bucket.bySite.get(site.site) ?? { visitors: 0, pageviews: 0 };
      aggregate.visitors += site.visitors;
      aggregate.pageviews += site.pageviews;
      bucket.bySite.set(site.site, aggregate);
    }
  }
  const rows = buckets.map((bucket, index) => ({
    label: DAY_NAMES[index],
    full: DAY_FULL[index],
    visitors: bucket.days ? bucket.visitors / bucket.days : 0,
    pageviews: bucket.days ? bucket.pageviews / bucket.days : 0,
    bySite: [...bucket.bySite].map(([site, values]) => ({
      site,
      visitors: bucket.days ? values.visitors / bucket.days : 0,
      pageviews: bucket.days ? values.pageviews / bucket.days : 0,
    })),
  }));
  const max = Math.max(1, ...rows.map((row) => row.visitors));
  const peak = rows.reduce((best, row) => (row.visitors > best.visitors ? row : best), rows[0]);
  return { rows, max, peak };
}

export function shareRows(rows: Array<{ label: string; count: number }>) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return rows.map((row, index) => ({
    label: row.label,
    pct: `${((row.count / total) * 100).toFixed(0)}%`,
    color: SHARE_COLORS[index % SHARE_COLORS.length],
    width: (row.count / total) * 100,
  }));
}

export function funnelChrome(index: number, last: boolean) {
  return {
    block: FUNNEL_BLOCKS[index % FUNNEL_BLOCKS.length],
    bar: FUNNEL_BARS[index % FUNNEL_BARS.length],
    clip: last ? "polygon(0 0,100% 0,100% 100%,0 100%)" : "polygon(0 0,100% 5%,100% 95%,0 100%)",
  };
}
