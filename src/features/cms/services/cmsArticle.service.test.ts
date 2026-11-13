import { afterEach, expect, it, vi } from "vitest";
import { createCmsArticle } from "./cmsArticle.service";
import type { CmsArticlePayload } from "../types/cms.types";

afterEach(() => vi.unstubAllGlobals());

const PAYLOAD: CmsArticlePayload = {
  site: "talimpo",
  slug: "artigo-edu",
  title: "Artigo de Limpeza",
  excerpt: "Resumo do artigo",
  bodyMarkdown: "Conteúdo",
  seoTitle: "",
  seoDescription: "",
  area: "Conhecimento",
  readingTime: "5 min",
  thumbnailAssetId: null,
  thumbnailUrl: "",
  thumbnailPosition: { x: 50, y: 50, zoom: 100 },
  authorName: "Ana",
  authorEmail: "ana@example.com",
  authorImageUrl: "https://example.com/ana.png",
};

it("sends and maps the education site", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    id: "1", site: "talimpo", status: "draft", slug: "artigo-edu",
    title: "Artigo de Limpeza", excerpt: "Resumo do artigo", body_markdown: "Conteúdo",
    seo_title: "Artigo de Limpeza", seo_description: "Resumo do artigo", area: "Conhecimento",
    reading_time: "5 min", thumbnail_asset_id: null, thumbnail_url: "",
    published_author_name: "Ana",
    published_by: "ana@example.com",
    published_author_image_url: "https://example.com/ana.png",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const result = await createCmsArticle(PAYLOAD);
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(init.body as string);

  expect(body.site).toBe("talimpo");
  expect(body.seo_title).toBe(PAYLOAD.title);
  expect(body.seo_description).toBe(PAYLOAD.excerpt);
  expect(body.author_name).toBe("Ana");
  expect(body.author_email).toBe("ana@example.com");
  expect(body.author_image_url).toBe("https://example.com/ana.png");
  expect(result.site).toBe("talimpo");
  expect(result.authorName).toBe("Ana");
  expect(result.authorEmail).toBe("ana@example.com");
  expect(result.authorImageUrl).toBe("https://example.com/ana.png");
});
