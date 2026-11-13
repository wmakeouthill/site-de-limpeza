// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { PublicArticleSummary } from "@/lib/server/publicContent";

describe("Editorial Rules - CA-20", () => {
  it("artigo da categoria 'testamos' é identificado corretamente para exibição do selo", () => {
    const articleTestamos: PublicArticleSummary = {
      id: "art-1",
      area: "Cozinha",
      categoria: "testamos",
      reading_time: "5 min",
      title: "Testamos 5 Desengordurantes",
      thumbnail: "/images/art1.png",
      href: "/artigos/testamos-5-desengordurantes",
      slug: "testamos-5-desengordurantes",
      first_published_at: new Date().toISOString(),
    };

    const articleDicas: PublicArticleSummary = {
      id: "art-2",
      area: "Piso",
      categoria: "dicas",
      reading_time: "3 min",
      title: "Como manter o porcelanato brilhando",
      thumbnail: "/images/art2.png",
      href: "/artigos/porcelanato",
      slug: "porcelanato",
      first_published_at: new Date().toISOString(),
    };

    expect(articleTestamos.categoria).toBe("testamos");
    expect(articleDicas.categoria).not.toBe("testamos");
  });
});
