import { useCallback, useEffect } from "react";

import { getCmsAnalyticsPages } from "../services/cmsAnalytics.service";
import type { AnalyticsPageList, ContactSiteScope } from "../types/cms.types";
import { readCmsQuery } from "./cmsQueryCache";
import { analyticsPagesKey } from "./cmsQueryKeys";
import { useCmsCachedQuery } from "./useCmsCachedQuery";

const EMPTY: AnalyticsPageList = { items: [], total: 0, page: 1, pageSize: 20 };

function prefetchNextPage(
  site: ContactSiteScope | undefined,
  period: { from: string; to: string },
  pages: AnalyticsPageList,
) {
  const nextPage = pages.page + 1;
  if ((nextPage - 1) * pages.pageSize >= pages.total) {
    return;
  }

  const nextKey = analyticsPagesKey(site, period, nextPage, pages.pageSize);
  void readCmsQuery(nextKey, () => getCmsAnalyticsPages(site, period, nextPage, pages.pageSize)).catch(
    () => undefined,
  );
}

export function useCmsAnalyticsPages(
  site: ContactSiteScope | undefined,
  period: { from: string; to: string },
  page: number,
  pageSize: number,
) {
  const cacheKey = analyticsPagesKey(site, period, page, pageSize);
  const from = period.from;
  const to = period.to;
  const fetcher = useCallback(
    () => getCmsAnalyticsPages(site, { from, to }, page, pageSize),
    [site, from, to, page, pageSize],
  );
  const { data, isLoading, isFetching, errorMessage } = useCmsCachedQuery(
    cacheKey,
    fetcher,
    EMPTY,
    "Não foi possível carregar as páginas vistas.",
    { keepPreviousData: true },
  );

  useEffect(() => {
    prefetchNextPage(site, { from, to }, data);
  }, [data, from, site, to]);

  return { pages: data, isLoading, isFetching, errorMessage };
}
