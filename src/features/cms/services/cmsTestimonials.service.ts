import type { CmsSiteScope, CmsTestimonial } from "../types/cms.types";
import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";

export interface CmsTestimonialInput {
  site: CmsSiteScope;
  author: string;
  role: string;
  company: string;
  quote: string;
  youtubeId: string;
  avatarUrl: string;
  isActive: boolean;
}

interface CmsTestimonialResponse {
  id: string;
  site: CmsSiteScope;
  author: string;
  role: string;
  company: string;
  quote: string;
  youtube_id: string;
  avatar_url: string;
  sort_order: number;
  is_active: boolean;
}

export async function listCmsTestimonials(site: CmsSiteScope): Promise<CmsTestimonial[]> {
  const response = await requestCmsJson<CmsTestimonialResponse[]>(
    `/api/cms/testimonials?site=${encodeURIComponent(site)}`,
  );
  return response.map(toCmsTestimonial);
}

export async function createCmsTestimonial(
  payload: CmsTestimonialInput,
): Promise<CmsTestimonial> {
  const response = await requestCmsJson<CmsTestimonialResponse>("/api/cms/testimonials", {
    method: "POST",
    body: JSON.stringify(toRequestBody(payload)),
  });
  return toCmsTestimonial(response);
}

export async function updateCmsTestimonial(
  id: string,
  payload: CmsTestimonialInput,
): Promise<CmsTestimonial> {
  const response = await requestCmsJson<CmsTestimonialResponse>(
    `/api/cms/testimonials/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(toRequestBody(payload)) },
  );
  return toCmsTestimonial(response);
}

export async function deleteCmsTestimonial(id: string): Promise<void> {
  await requestCmsVoid(`/api/cms/testimonials/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function reorderCmsTestimonials(
  site: CmsSiteScope,
  ids: string[],
): Promise<void> {
  await requestCmsVoid("/api/cms/testimonials/reorder", {
    method: "PUT",
    body: JSON.stringify({ site, ids }),
  });
}

function toRequestBody(payload: CmsTestimonialInput) {
  return {
    site: payload.site,
    author: payload.author,
    role: payload.role,
    company: payload.company,
    quote: payload.quote,
    youtube_id: payload.youtubeId,
    avatar_url: payload.avatarUrl,
    is_active: payload.isActive,
  };
}

function toCmsTestimonial(item: CmsTestimonialResponse): CmsTestimonial {
  return {
    id: item.id,
    site: item.site,
    author: item.author,
    role: item.role,
    company: item.company,
    quote: item.quote,
    youtubeId: item.youtube_id,
    avatarUrl: item.avatar_url,
    sortOrder: item.sort_order,
    isActive: item.is_active,
  };
}
