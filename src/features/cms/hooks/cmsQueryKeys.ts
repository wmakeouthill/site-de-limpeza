import type {
  CmsContentStatus,
  CmsContentType,
  CmsSiteScope,
  ContactSiteScope,
} from "../types/cms.types";

export function contentKey(
  contentType: CmsContentType,
  status: CmsContentStatus | undefined,
  site: CmsSiteScope | undefined,
) {
  return `content:${contentType}:${status ?? "all"}:${site ?? "all"}`;
}

export function analyticsKey(
  site: ContactSiteScope | undefined,
  from: string,
  to: string,
) {
  return `analytics:${site ?? "all"}:${from}:${to}`;
}

export function analyticsPagesKey(
  site: ContactSiteScope | undefined,
  range: { from: string; to: string } | undefined,
  page: number,
  pageSize: number,
) {
  return `analytics-pages:${site ?? "all"}:${range?.from ?? "default"}:${range?.to ?? "default"}:${page}:${pageSize}`;
}

export function settingsKey() {
  return "settings";
}

export function testimonialsKey(site?: string) {
  return `testimonials:${site ?? "all"}`;
}

