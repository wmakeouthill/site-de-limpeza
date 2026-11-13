import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";
import type {
  CmsContentStatus,
  CmsGuide,
  CmsGuidePayload,
  CmsGuideProduto,
  CmsPublicoGuia,
  CmsSiteScope,
} from "../types/cms.types";

interface CmsGuideResponse {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  seo_title: string;
  seo_description: string;
  cover_asset_id: string | null;
  publico: CmsPublicoGuia;
  tempo_minutos: number;
  etiqueta: string;
  icone: string;
  dificuldade: string;
  produtos: CmsGuideProduto[];
  author_name?: string | null;
  author_email?: string | null;
  author_image_url?: string | null;
  published_by?: string | null;
  published_author_name?: string | null;
  published_author_image_url?: string | null;
}

export async function listCmsGuides(): Promise<CmsGuide[]> {
  const response = await requestCmsJson<CmsGuideResponse[]>("/api/cms/guides");
  return response.map(toCmsGuide);
}

export async function getCmsGuide(guideId: string): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(`/api/cms/guides/${guideId}`);
  return toCmsGuide(response);
}

export async function createCmsGuide(payload: CmsGuidePayload): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>("/api/cms/guides", {
    method: "POST",
    body: JSON.stringify(toGuideRequest(payload)),
  });
  return toCmsGuide(response);
}

export async function updateCmsGuide(
  guideId: string,
  payload: CmsGuidePayload,
): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(`/api/cms/guides/${guideId}`, {
    method: "PUT",
    body: JSON.stringify(toGuideRequest(payload)),
  });
  return toCmsGuide(response);
}

export async function publishCmsGuide(guideId: string): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(
    `/api/cms/guides/${guideId}/publish`,
    { method: "POST" },
  );
  return toCmsGuide(response);
}

export async function unpublishCmsGuide(guideId: string): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(
    `/api/cms/guides/${guideId}/unpublish`,
    { method: "POST" },
  );
  return toCmsGuide(response);
}

export async function archiveCmsGuide(guideId: string): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(
    `/api/cms/guides/${guideId}/archive`,
    { method: "POST" },
  );
  return toCmsGuide(response);
}

export async function unarchiveCmsGuide(guideId: string): Promise<CmsGuide> {
  const response = await requestCmsJson<CmsGuideResponse>(
    `/api/cms/guides/${guideId}/unarchive`,
    { method: "POST" },
  );
  return toCmsGuide(response);
}

export async function deleteCmsGuide(guideId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/guides/${guideId}`, { method: "DELETE" });
}

function toGuideRequest(payload: CmsGuidePayload) {
  return {
    site: payload.site,
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    body_markdown: payload.bodyMarkdown,
    cover_asset_id: payload.coverAssetId,
    seo_title: payload.seoTitle || payload.title,
    seo_description: payload.seoDescription || payload.excerpt,
    author_name: payload.authorName || "",
    author_email: payload.authorEmail || null,
    author_image_url: payload.authorImageUrl || "",
    guide_detail: {
      publico: payload.publico,
      tempo_minutos: payload.tempoMinutos,
      etiqueta: payload.etiqueta,
      icone: payload.icone,
      dificuldade: payload.dificuldade,
    },
    produtos: payload.produtos.map((p, idx) => ({
      produto_id: p.produto_id,
      quantidade: p.quantidade,
      ordem: p.ordem ?? idx,
    })),
  };
}

function toCmsGuide(response: CmsGuideResponse): CmsGuide {
  const authorName =
    response.published_author_name ?? response.author_name ?? "";
  const authorEmail =
    response.author_email ?? response.published_by ?? null;
  const authorImageUrl =
    response.published_author_image_url ?? response.author_image_url ?? "";

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
    coverAssetId: response.cover_asset_id,
    publico: response.publico,
    tempoMinutos: response.tempo_minutos,
    etiqueta: response.etiqueta,
    icone: response.icone,
    dificuldade: response.dificuldade,
    produtos: response.produtos ?? [],
    authorName,
    authorEmail,
    authorImageUrl,
  };
}
