import { afterEach, expect, it, vi } from "vitest";

import { rangeFor } from "../pages/CmsAnalyticsPage/CmsAnalyticsPage.utils";
import { getCmsAnalytics, getCmsAnalyticsPages } from "../services/cmsAnalytics.service";
import { listCmsContent } from "../services/cmsContent.service";
import { getCmsSiteSettings } from "../services/cmsSiteSettings.service";
import { clearCmsQueryCache, peekCmsQuery } from "./cmsQueryCache";
import { analyticsKey, analyticsPagesKey, contentKey, settingsKey } from "./cmsQueryKeys";
import { prefetchCmsScreens } from "./prefetchCmsScreens";

vi.mock("../services/cmsContent.service", () => ({
  listCmsContent: vi.fn(async () => ({ items: [], total: 0 })),
}));
vi.mock("../services/cmsAnalytics.service", () => ({
  getCmsAnalytics: vi.fn(async () => ({ overview: { visitors: 1 } })),
  getCmsAnalyticsPages: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
}));
vi.mock("../services/cmsSiteSettings.service", () => ({
  getCmsSiteSettings: vi.fn(async () => ({ articlesEnabled: { falcao: true } })),
}));

afterEach(() => {
  clearCmsQueryCache();
  vi.clearAllMocks();
});

it("preenche o cache da primeira pagina de cada tela do CMS", async () => {
  await prefetchCmsScreens();

  const period = rangeFor("30d");
  expect(peekCmsQuery(contentKey("article", undefined, "falcao"))).toEqual({ items: [], total: 0 });
  expect(peekCmsQuery(contentKey("case", undefined, "falcao"))).toEqual({ items: [], total: 0 });
  expect(peekCmsQuery(analyticsKey("falcao", period.from, period.to))).toBeTruthy();
  expect(peekCmsQuery(analyticsPagesKey("falcao", period, 1, 20))).toBeTruthy();
  expect(peekCmsQuery(settingsKey())).toBeTruthy();
  expect(listCmsContent).toHaveBeenCalledTimes(2);
  expect(getCmsAnalytics).toHaveBeenCalledTimes(1);
  expect(getCmsAnalyticsPages).toHaveBeenCalledTimes(1);
  expect(getCmsSiteSettings).toHaveBeenCalledTimes(1);
});
