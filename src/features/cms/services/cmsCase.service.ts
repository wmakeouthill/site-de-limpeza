import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";
import type {
  CmsCase,
  CmsCasePayload,
  CmsCaseTag,
  CmsContentStatus,
  CmsSiteScope,
} from "../types/cms.types";

interface CmsCaseMetricResponse {
  prefix: string;
  value: string;
  label: string;
  sort_order: number;
}

interface CmsCaseTagResponse {
  label: string;
  sort_order: number;
}

interface CmsCaseResponse {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  seo_title: string;
  seo_description: string;
  topic?: string;
  client_name?: string;
  client_logo_asset_id?: string | null;
  client_logo_url?: string;
  company_icon_asset_id?: string | null;
  company_icon_url?: string;
  screenshot_asset_id: string | null;
  screenshot_url: string;
  screenshot_position_x?: number;
  screenshot_position_y?: number;
  screenshot_zoom?: number;
  metrics?: CmsCaseMetricResponse[];
  tags: CmsCaseTagResponse[];
}

export async function getCmsCase(caseId: string): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}`);
  return toCmsCase(response);
}

export async function createCmsCase(payload: CmsCasePayload): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>("/api/cms/cases", {
    method: "POST",
    // O site só é definido na criação; o CaseUpdate da API recusa campos extras.
    body: JSON.stringify({ site: payload.site ?? "falcao", ...toCaseRequest(payload) }),
  });
  return toCmsCase(response);
}

export async function updateCmsCase(caseId: string, payload: CmsCasePayload): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}`, {
    method: "PUT",
    body: JSON.stringify(toCaseRequest(payload)),
  });
  return toCmsCase(response);
}

export async function publishCmsCase(caseId: string): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}/publish`, {
    method: "POST",
  });
  return toCmsCase(response);
}

export async function unpublishCmsCase(caseId: string): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}/unpublish`, {
    method: "POST",
  });
  return toCmsCase(response);
}

export async function archiveCmsCase(caseId: string): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}/archive`, {
    method: "POST",
  });
  return toCmsCase(response);
}

export async function unarchiveCmsCase(caseId: string): Promise<CmsCase> {
  const response = await requestCmsJson<CmsCaseResponse>(`/api/cms/cases/${caseId}/unarchive`, {
    method: "POST",
  });
  return toCmsCase(response);
}

export async function deleteCmsCase(caseId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/cases/${caseId}`, { method: "DELETE" });
}

function toCaseRequest(payload: CmsCasePayload) {
  const topic = (payload.topic || payload.clientName || "").trim();
  if (!topic) {
    throw new Error("O campo Tema / Área Penal é obrigatório.");
  }

  return {
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    body_markdown: payload.bodyMarkdown,
    cover_asset_id: null,
    seo_title: payload.seoTitle || payload.title,
    seo_description: payload.seoDescription || payload.excerpt,
    case_detail: {
      topic,
      screenshot_asset_id: payload.screenshotAssetId,
      screenshot_url: payload.screenshotUrl,
      screenshot_position_x: payload.screenshotPosition?.x ?? 50,
      screenshot_position_y: payload.screenshotPosition?.y ?? 50,
      screenshot_zoom: payload.screenshotPosition?.zoom ?? 100,
    },
    tags: (payload.tags ?? []).map((tag: CmsCaseTag, index: number) => ({
      label: tag.label,
      sort_order: index,
    })),
  };
}

function toCmsCase(response: CmsCaseResponse): CmsCase {
  const topic = response.topic || response.client_name || "";
  return {
    id: response.id,
    site: response.site,
    status: response.status,
    slug: response.slug,
    title: response.title,
    excerpt: response.excerpt,
    bodyMarkdown: response.body_markdown,
    seoTitle: response.seo_title,
    seoDescription: response.seo_description,
    topic,
    clientName: topic,
    screenshotAssetId: response.screenshot_asset_id,
    screenshotUrl: response.screenshot_url,
    screenshotPosition: {
      x: response.screenshot_position_x ?? 50,
      y: response.screenshot_position_y ?? 50,
      zoom: response.screenshot_zoom ?? 100,
    },
    tags: [...(response.tags ?? [])]
      .sort((first, second) => first.sort_order - second.sort_order)
      .map((tag) => ({ label: tag.label })),
  };
}
