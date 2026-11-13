import type { CampaignSourceLink } from "../types/cms.types";
import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";

export interface CampaignSourceLinkInput {
  title: string;
  sourceUrl: string;
  thumbnailUrl: string;
  redirectUrl: string;
}

interface CampaignSourceLinkResponse {
  identifier: string;
  title: string;
  source_url: string;
  thumbnail_url: string;
  redirect_url: string;
}

export async function listCmsCampaignLinks(): Promise<CampaignSourceLink[]> {
  const response = await requestCmsJson<CampaignSourceLinkResponse[]>("/api/cms/campaign-links");
  return response.map(toCampaignSourceLink);
}

export async function upsertCmsCampaignLink(
  identifier: string,
  payload: CampaignSourceLinkInput,
): Promise<CampaignSourceLink> {
  const response = await requestCmsJson<CampaignSourceLinkResponse>(
    `/api/cms/campaign-links/${encodeURIComponent(identifier)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        title: payload.title,
        source_url: payload.sourceUrl,
        thumbnail_url: payload.thumbnailUrl,
        redirect_url: payload.redirectUrl,
      }),
    },
  );
  return toCampaignSourceLink(response);
}

export async function deleteCmsCampaignLink(identifier: string): Promise<void> {
  await requestCmsVoid(`/api/cms/campaign-links/${encodeURIComponent(identifier)}`, {
    method: "DELETE",
  });
}

function toCampaignSourceLink(link: CampaignSourceLinkResponse): CampaignSourceLink {
  return {
    identifier: link.identifier,
    title: link.title,
    sourceUrl: link.source_url,
    thumbnailUrl: link.thumbnail_url,
    redirectUrl: link.redirect_url,
  };
}
