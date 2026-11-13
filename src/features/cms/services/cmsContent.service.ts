import { requestCmsJson } from "./cmsApi.service";
import type {
  CmsContentFilters,
  CmsContentList,
  CmsContentStatus,
  CmsContentSummary,
  CmsContentType,
  CmsSiteScope,
} from "../types/cms.types";

interface CmsContentSummaryResponse {
  id: string;
  site: CmsSiteScope;
  content_type: CmsContentType;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  updated_at: string | null;
  published_at: string | null;
  detail_label: string;
}

interface CmsContentListResponse {
  items: CmsContentSummaryResponse[];
  total: number;
}

export async function listCmsContent(filters: CmsContentFilters): Promise<CmsContentList> {
  const params = new URLSearchParams({ type: filters.contentType });
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.site) {
    params.set("site", filters.site);
  }

  const response = await requestCmsJson<CmsContentListResponse>(
    `/api/cms/content?${params.toString()}`,
  );

  return {
    total: response.total,
    items: response.items.map(toCmsContentSummary),
  };
}

function toCmsContentSummary(item: CmsContentSummaryResponse): CmsContentSummary {
  return {
    id: item.id,
    site: item.site,
    contentType: item.content_type,
    status: item.status,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    updatedAt: item.updated_at,
    publishedAt: item.published_at,
    detailLabel: item.detail_label,
  };
}
