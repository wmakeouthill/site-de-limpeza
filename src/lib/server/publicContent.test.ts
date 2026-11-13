import { describe, expect, it, vi } from "vitest";
import {
  getHomeEditorialData,
  getPublicArticle,
  getPublicArticlesList,
  getPublicGuide,
  getPublicGuidesList,
  getPublicSiteSettings,
  PublicContentUnavailableError,
} from "./publicContent";

describe("publicContent server module", () => {
  it("getPublicArticle returns article details on 200", async () => {
    const mockArticle = {
      id: "artigo-1",
      slug: "artigo-1",
      title: "Artigo de Teste",
      area: "Penal",
      reading_time: "5 min",
      thumbnail: "/media/thumb.webp",
      href: "/artigos/artigo-1",
      excerpt: "Resumo do artigo",
      body_markdown: "# Conteúdo",
      seo_title: "Artigo SEO",
      seo_description: "Desc SEO",
      author: "Gabriel Falcão",
      first_published_at: "2026-07-01T12:00:00Z",
      published_at: "2026-07-01T12:00:00Z",
      updated_at: "2026-07-02T12:00:00Z",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockArticle,
    });

    const result = await getPublicArticle("artigo-1", { fetchFn: mockFetch as unknown as typeof fetch });
    expect(result).toEqual(mockArticle);
  });

  it("getPublicArticle returns null when upstream returns 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not found" }),
    });

    const result = await getPublicArticle("artigo-inexistente", {
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it("getPublicArticle throws PublicContentUnavailableError on 502/500 without masking as 404", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ detail: "Bad gateway" }),
    });

    await expect(
      getPublicArticle("qualquer-slug", { fetchFn: mockFetch as unknown as typeof fetch })
    ).rejects.toThrow(PublicContentUnavailableError);
  });

  it("getPublicArticle throws PublicContentUnavailableError on timeout/abort", async () => {
    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    });

    await expect(
      getPublicArticle("qualquer-slug", {
        fetchFn: mockFetch as unknown as typeof fetch,
        timeoutMs: 10,
      })
    ).rejects.toThrow(PublicContentUnavailableError);
  });

  it("getPublicGuide returns guide on 200 and null on 404", async () => {
    const mockGuide = {
      id: "guia-1",
      slug: "guia-1",
      title: "Guia de Prisão em Flagrante",
      topic: "Custódia",
      tags: ["Prisão", "Flagrante"],
      screenshot: "/media/case.webp",
      excerpt: "Orientações sobre flagrante",
      body_markdown: "# Guia passo a passo",
      seo_title: "Guia Flagrante",
      seo_description: "Desc Guia",
      author: "Gabriel Falcão",
      first_published_at: "2026-07-01T12:00:00Z",
      published_at: "2026-07-01T12:00:00Z",
      updated_at: "2026-07-02T12:00:00Z",
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/guides/guia-1")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockGuide,
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      });
    });

    const found = await getPublicGuide("guia-1", { fetchFn: mockFetch as unknown as typeof fetch });
    expect(found).toEqual(mockGuide);

    const notFound = await getPublicGuide("guia-inexistente", {
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(notFound).toBeNull();
  });

  it("getPublicArticlesList and getPublicGuidesList return lists or empty arrays", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/articles")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ id: "a1", slug: "a1", title: "A1" }],
        });
      }
      if (url.includes("/guides")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ id: "g1", slug: "g1", title: "G1" }],
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    const articles = await getPublicArticlesList({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(articles).toEqual([{ id: "a1", slug: "a1", title: "A1" }]);

    const guides = await getPublicGuidesList({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(guides).toEqual([{ id: "g1", slug: "g1", title: "G1" }]);
  });

  it("getPublicSiteSettings returns settings and handles toggle values", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        articles_enabled: true,
        guides_enabled: false,
        testimonials_enabled: false,
      }),
    });

    const settings = await getPublicSiteSettings({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(settings.articles_enabled).toBe(true);
    expect(settings.guides_enabled).toBe(false);
    expect(settings.testimonials_enabled).toBe(false);
    expect(settings.loja_nome).toBe("Falcão Limpeza");
    expect(settings.whatsapp_numero).toBe("5521999999999");
  });

  it("getHomeEditorialData combines settings, featured article, and guides", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/site-settings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ articles_enabled: true, guides_enabled: true, testimonials_enabled: false }),
        });
      }
      if (url.includes("/articles")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { id: "a1", slug: "a1", title: "Destaque 1", area: "Penal", reading_time: "5 min", thumbnail: "", href: "/artigos/a1", first_published_at: null },
            { id: "a2", slug: "a2", title: "Recente 2", area: "Penal", reading_time: "3 min", thumbnail: "", href: "/artigos/a2", first_published_at: null },
            { id: "a3", slug: "a3", title: "Recente 3", area: "Penal", reading_time: "4 min", thumbnail: "", href: "/artigos/a3", first_published_at: null },
            { id: "a4", slug: "a4", title: "Excedente", area: "Penal", reading_time: "6 min", thumbnail: "", href: "/artigos/a4", first_published_at: null },
          ],
        });
      }
      if (url.includes("/guides")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { id: "g1", slug: "g1", title: "Guia 1", topic: "Audiência", tags: ["Custódia"], screenshot: "", first_published_at: null },
            { id: "g2", slug: "g2", title: "Guia 2", topic: "Júri", tags: ["Tribunal"], screenshot: "", first_published_at: null },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const homeData = await getHomeEditorialData({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(homeData).not.toBeNull();
    expect(homeData?.settings.articles_enabled).toBe(true);
    expect(homeData?.featuredArticle?.slug).toBe("a1");
    expect(homeData?.recentArticles.length).toBe(2);
    expect(homeData?.recentArticles.map((a) => a.slug)).toEqual(["a2", "a3"]);
    expect(homeData?.recentGuides.length).toBe(2);
  });

  it("getHomeEditorialData returns null when upstream throws error without failing landing page", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const homeData = await getHomeEditorialData({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(homeData).toBeNull();
  });

  it("getHomeEditorialData respects articles_enabled = false and omits articles fetch", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/site-settings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ articles_enabled: false, guides_enabled: true, testimonials_enabled: false }),
        });
      }
      if (url.includes("/guides")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { id: "g1", slug: "g1", title: "Guia 1", topic: "Audiência", tags: [], screenshot: "", first_published_at: null },
          ],
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const homeData = await getHomeEditorialData({ fetchFn: mockFetch as unknown as typeof fetch });
    expect(homeData).not.toBeNull();
    expect(homeData?.settings.articles_enabled).toBe(false);
    expect(homeData?.featuredArticle).toBeNull();
    expect(homeData?.recentArticles).toEqual([]);
    expect(homeData?.recentGuides.length).toBe(1);
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("/articles"), expect.anything());
  });
});
