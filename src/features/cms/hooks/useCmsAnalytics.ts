import { useCallback } from "react";

import { getCmsAnalytics } from "../services/cmsAnalytics.service";
import type { AnalyticsDashboard, ContactSiteScope } from "../types/cms.types";
import { analyticsKey } from "./cmsQueryKeys";
import { useCmsCachedQuery } from "./useCmsCachedQuery";

const EMPTY: AnalyticsDashboard = {
  overview: {
    visitors: 0,
    pageviews: 0,
    clicks: 0,
    formSubmits: 0,
    medianDwellMs: 0,
    bounceRate: 0,
  },
  period: { start: "", end: "" },
  comparisonOverview: {
    visitors: 0,
    pageviews: 0,
    clicks: 0,
    formSubmits: 0,
    medianDwellMs: 0,
    bounceRate: 0,
  },
  timeseries: [],
  comparisonTimeseries: [],
  weeklyRhythm: [],
  pagesPerSession: 0,
  channels: [],
  funnel: [],
  topPages: [],
  topCtas: [],
  sources: [],
  devices: [],
};

export function useCmsAnalytics(
  site: ContactSiteScope | undefined,
  period: { from: string; to: string },
) {
  const cacheKey = analyticsKey(site, period.from, period.to);
  const from = period.from;
  const to = period.to;
  const fetcher = useCallback(
    () => getCmsAnalytics(site, { from, to }),
    [site, from, to],
  );
  const { data, isLoading, errorMessage } = useCmsCachedQuery(
    cacheKey,
    fetcher,
    EMPTY,
    "Nao foi possivel carregar as metricas.",
    { keepPreviousData: true },
  );

  return { dashboard: data, isLoading, errorMessage };
}
