import { rangeFor } from "../pages/CmsAnalyticsPage/CmsAnalyticsPage.utils";
import { getCmsAnalytics, getCmsAnalyticsPages } from "../services/cmsAnalytics.service";
import { listCmsContent } from "../services/cmsContent.service";
import { getCmsSiteSettings } from "../services/cmsSiteSettings.service";
import { readCmsQuery } from "./cmsQueryCache";
import {
  analyticsKey,
  analyticsPagesKey,
  contentKey,
  settingsKey,
} from "./cmsQueryKeys";

const ANALYTICS_PAGE_SIZE = 20;

function warm<T>(key: string, fetcher: () => Promise<T>) {
  return readCmsQuery(key, fetcher).catch(() => undefined);
}

export function prefetchCmsScreens() {
  const period = rangeFor("30d");

  return Promise.allSettled([
    warm(contentKey("article", undefined, "falcao"), () =>
      listCmsContent({ contentType: "article", site: "falcao" }),
    ),
    warm(contentKey("case", undefined, "falcao"), () =>
      listCmsContent({ contentType: "case", site: "falcao" }),
    ),
    warm(analyticsKey("falcao", period.from, period.to), () => getCmsAnalytics("falcao", period)),
    warm(analyticsPagesKey("falcao", period, 1, ANALYTICS_PAGE_SIZE), () =>
      getCmsAnalyticsPages("falcao", period, 1, ANALYTICS_PAGE_SIZE),
    ),
    warm(settingsKey(), () => getCmsSiteSettings()),
  ]);
}

export function prefetchCmsRouteModules() {
  void import("../pages/CmsContentPage");
  void import("../pages/CmsAnalyticsPage");
  void import("../pages/CmsSettingsPage");
}
