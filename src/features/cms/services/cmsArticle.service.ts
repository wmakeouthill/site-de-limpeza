import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";
import type { CmsArticle, CmsArticlePayload, CmsContentStatus, CmsSiteScope } from "../types/cms.types";

interface CmsArticleResponse {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  seo_title: string;
  seo_description: string;
  area: string;
  categoria?: string;
  reading_time: string;
  thumbnail_asset_id: string | null;
  thumbnail_url: string;
  thumbnail_position_x?: number;
  thumbnail_position_y?: number;
  thumbnail_zoom?: number;
  author_name?: string | null;
  author_email?: string | null;
  author_image_url?: string | null;
  published_by?: string | null;
  published_author_name?: string | null;
  published_author_image_url?: string | null;
}

export async function getCmsArticle(articleId: string): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(`/api/cms/articles/${articleId}`);
  return toCmsArticle(response);
}

export async function createCmsArticle(payload: CmsArticlePayload): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>("/api/cms/articles", {
    method: "POST",
    body: JSON.stringify(toArticleRequest(payload)),
  });
  return toCmsArticle(response);
}

export async function updateCmsArticle(
  articleId: string,
  payload: CmsArticlePayload,
): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(`/api/cms/articles/${articleId}`, {
    method: "PUT",
    body: JSON.stringify(toArticleRequest(payload)),
  });
  return toCmsArticle(response);
}

export async function publishCmsArticle(articleId: string): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(
    `/api/cms/articles/${articleId}/publish`,
    { method: "POST" },
  );
  return toCmsArticle(response);
}

export async function unpublishCmsArticle(articleId: string): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(
    `/api/cms/articles/${articleId}/unpublish`,
    { method: "POST" },
  );
  return toCmsArticle(response);
}

export async function archiveCmsArticle(articleId: string): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(
    `/api/cms/articles/${articleId}/archive`,
    { method: "POST" },
  );
  return toCmsArticle(response);
}

export async function unarchiveCmsArticle(articleId: string): Promise<CmsArticle> {
  const response = await requestCmsJson<CmsArticleResponse>(
    `/api/cms/articles/${articleId}/unarchive`,
    { method: "POST" },
  );
  return toCmsArticle(response);
}

export async function deleteCmsArticle(articleId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/articles/${articleId}`, { method: "DELETE" });
}

function toArticleRequest(payload: CmsArticlePayload) {
  return {
    site: payload.site,
    slug: payload.slug,
    title: payload.title,
    excerpt: payload.excerpt,
    body_markdown: payload.bodyMarkdown,
    cover_asset_id: null,
    seo_title: payload.title,
    seo_description: payload.excerpt,
    author_name: payload.authorName || "",
    author_email: payload.authorEmail || null,
    author_image_url: payload.authorImageUrl || "",
    article_detail: {
      area: payload.area,
      categoria: payload.categoria || 'geral',
      reading_time: payload.readingTime,
      thumbnail_asset_id: payload.thumbnailAssetId,
      thumbnail_url: payload.thumbnailUrl,
      thumbnail_position_x: payload.thumbnailPosition.x,
      thumbnail_position_y: payload.thumbnailPosition.y,
      thumbnail_zoom: payload.thumbnailPosition.zoom,
    },
  };
}

function toCmsArticle(response: CmsArticleResponse): CmsArticle {
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
    area: response.area,
    categoria: response.categoria ?? 'geral',
    readingTime: response.reading_time,
    thumbnailAssetId: response.thumbnail_asset_id,
    thumbnailUrl: response.thumbnail_url,
    thumbnailPosition: {
      x: response.thumbnail_position_x ?? 50,
      y: response.thumbnail_position_y ?? 50,
      zoom: response.thumbnail_zoom ?? 100,
    },
    authorName,
    authorEmail,
    authorImageUrl,
  };
}
