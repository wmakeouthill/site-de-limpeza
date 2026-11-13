import { requestCmsJson } from "./cmsApi.service";
import type {
  AnalyticsCampaign,
  AnalyticsCreative,
  AnalyticsDashboard,
  AnalyticsChannel,
  AnalyticsFunnelStep,
  AnalyticsPoint,
  AnalyticsPointSite,
  AnalyticsRow,
  AnalyticsSiteCount,
  AnalyticsWeeklyRhythmPoint,
  AnalyticsPageList,
  ContactSiteScope,
} from "../types/cms.types";

interface AnalyticsRowResponse {
  label: string;
  count: number;
  raw_labels?: Array<{ label: string; count: number }>;
  pos_x: number | null;
  pos_y: number | null;
  by_site?: AnalyticsSiteCountResponse[];
  campaigns?: AnalyticsCampaignResponse[];
}

interface AnalyticsCampaignResponse {
  label: string;
  count: number;
  creatives?: AnalyticsCreativeResponse[];
}

interface AnalyticsCreativeResponse {
  label: string;
  count: number;
  placement?: string;
  link?: {
    identifier: string;
    title: string;
    source_url: string;
    thumbnail_url: string;
    redirect_url: string;
  } | null;
}

interface AnalyticsSiteCountResponse {
  site: ContactSiteScope;
  count: number;
}

interface AnalyticsPointResponse {
  day: string;
  visitors: number;
  pageviews: number;
  by_site?: Array<{ site: ContactSiteScope; visitors: number; pageviews: number }>;
}

interface AnalyticsFunnelStepResponse {
  step: string;
  label: string;
  sessions: number;
  rate: number;
  by_site?: AnalyticsSiteCountResponse[];
}

interface AnalyticsDashboardResponse {
  overview: {
    visitors: number;
    pageviews: number;
    clicks: number;
    form_submits: number;
    median_dwell_ms: number;
    bounce_rate: number;
  };
  period: { start: string; end: string };
  comparison_overview: AnalyticsDashboardResponse["overview"];
  timeseries: AnalyticsPointResponse[];
  comparison_timeseries: AnalyticsPointResponse[];
  weekly_rhythm: AnalyticsWeeklyRhythmPoint[];
  pages_per_session: number;
  channels: Array<{ site: ContactSiteScope; overview: AnalyticsDashboardResponse["overview"] }>;
  funnel: AnalyticsFunnelStepResponse[];
  top_pages: AnalyticsRowResponse[];
  top_ctas: AnalyticsRowResponse[];
  sources: AnalyticsRowResponse[];
  devices: AnalyticsRowResponse[];
  whatsapp_clicks?: AnalyticsRowResponse[];
  top_lista_products?: AnalyticsRowResponse[];
  top_search_terms?: AnalyticsRowResponse[];
  promotions_summary?: AnalyticsRowResponse[];
}

interface AnalyticsPageListResponse {
  items: Array<{ site: ContactSiteScope; path: string; pageviews: number }>;
  total: number;
  page: number;
  page_size: number;
}

export async function getCmsAnalytics(
  site: ContactSiteScope | undefined,
  period: { from: string; to: string },
): Promise<AnalyticsDashboard> {
  const params = new URLSearchParams({ from: period.from, to: period.to });
  if (site) {
    params.set("site", site);
  }

  const response = await requestCmsJson<AnalyticsDashboardResponse>(
    `/api/cms/analytics?${params.toString()}`,
  );

  return {
    overview: {
      visitors: response.overview.visitors,
      pageviews: response.overview.pageviews,
      clicks: response.overview.clicks,
      formSubmits: response.overview.form_submits,
      medianDwellMs: response.overview.median_dwell_ms,
      bounceRate: response.overview.bounce_rate,
    },
    period: response.period,
    comparisonOverview: toOverview(response.comparison_overview),
    timeseries: response.timeseries.map(toPoint),
    comparisonTimeseries: response.comparison_timeseries.map(toPoint),
    weeklyRhythm: response.weekly_rhythm,
    pagesPerSession: response.pages_per_session,
    channels: response.channels.map((channel): AnalyticsChannel => ({
      site: channel.site,
      overview: toOverview(channel.overview),
    })),
    funnel: response.funnel.map(toFunnelStep),
    topPages: response.top_pages.map(toRow),
    topCtas: response.top_ctas.map(toRow),
    sources: response.sources.map(toRow),
    devices: response.devices.map(toRow),
    whatsappClicks: response.whatsapp_clicks ? response.whatsapp_clicks.map(toRow) : [],
    topListaProducts: response.top_lista_products ? response.top_lista_products.map(toRow) : [],
    topSearchTerms: response.top_search_terms ? response.top_search_terms.map(toRow) : [],
    promotionsSummary: response.promotions_summary ? response.promotions_summary.map(toRow) : [],
  };
}

export async function getCmsAnalyticsPages(
  site: ContactSiteScope | undefined,
  period: { from: string; to: string },
  page: number,
  pageSize: number,
): Promise<AnalyticsPageList> {
  const params = new URLSearchParams({
    from: period.from,
    to: period.to,
    page: String(page),
    page_size: String(pageSize),
  });
  if (site) params.set("site", site);
  const response = await requestCmsJson<AnalyticsPageListResponse>(
    `/api/cms/analytics/pages?${params.toString()}`,
  );
  return {
    items: response.items,
    total: response.total,
    page: response.page,
    pageSize: response.page_size,
  };
}

function toOverview(overview: AnalyticsDashboardResponse["overview"]) {
  return {
    visitors: overview.visitors,
    pageviews: overview.pageviews,
    clicks: overview.clicks,
    formSubmits: overview.form_submits,
    medianDwellMs: overview.median_dwell_ms,
    bounceRate: overview.bounce_rate,
  };
}

function toRow(row: AnalyticsRowResponse): AnalyticsRow {
  return {
    label: row.label,
    count: row.count,
    rawLabels: row.raw_labels,
    posX: row.pos_x,
    posY: row.pos_y,
    bySite: row.by_site?.map(toSiteCount) ?? [],
    campaigns: row.campaigns?.map(toCampaign),
  };
}

function toCampaign(campaign: AnalyticsCampaignResponse): AnalyticsCampaign {
  return {
    label: campaign.label,
    count: campaign.count,
    creatives: campaign.creatives?.map(toCreative) ?? [],
  };
}

function toCreative(creative: AnalyticsCreativeResponse): AnalyticsCreative {
  return {
    label: creative.label,
    count: creative.count,
    placement: creative.placement ?? "",
    link: creative.link
      ? {
          identifier: creative.link.identifier,
          title: creative.link.title,
          sourceUrl: creative.link.source_url,
          thumbnailUrl: creative.link.thumbnail_url,
          redirectUrl: creative.link.redirect_url,
        }
      : null,
  };
}

function toPoint(point: AnalyticsPointResponse): AnalyticsPoint {
  return {
    day: point.day,
    visitors: point.visitors,
    pageviews: point.pageviews,
    bySite: point.by_site?.map(
      (item): AnalyticsPointSite => ({
        site: item.site,
        visitors: item.visitors,
        pageviews: item.pageviews,
      }),
    ) ?? [],
  };
}

function toFunnelStep(step: AnalyticsFunnelStepResponse): AnalyticsFunnelStep {
  return {
    step: step.step,
    label: step.label,
    sessions: step.sessions,
    rate: step.rate,
    bySite: step.by_site?.map(toSiteCount) ?? [],
  };
}

function toSiteCount(item: AnalyticsSiteCountResponse): AnalyticsSiteCount {
  return { site: item.site, count: item.count };
}
