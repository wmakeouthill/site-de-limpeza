import type { CmsSiteScope } from "../types/cms.types";

export function getPublicArticleHref(_site: CmsSiteScope, slug: string): string {
  return buildPublicHref(`/artigos/${slug}`);
}

export function getPublicCaseHref(_site: CmsSiteScope, slug: string): string {
  return buildPublicHref(`/guias/${slug}`);
}

function buildPublicHref(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl =
    normalizeBaseUrl(import.meta.env.PUBLIC_SITE_URL) ||
    normalizeBaseUrl(import.meta.env.VITE_PUBLIC_SITE_URL);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

function normalizeBaseUrl(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}
