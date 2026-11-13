import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getSitemap } from "@/pages/sitemap.xml";

vi.mock("@/lib/server/publicContent", () => ({
  getPublicSiteSettings: vi.fn(async () => ({
    site_id: "falcao",
    loja_nome: "Falcão Limpeza",
    whatsapp_numero: "5521999999999",
    articles_enabled: true,
    guides_enabled: true,
  })),
  getPublicArticlesList: vi.fn(async () => [
    { slug: "artigo-teste-1", first_published_at: "2026-10-01" },
  ]),
  getPublicGuidesList: vi.fn(async () => [
    { slug: "guia-limpeza-pos-obra", first_published_at: "2026-10-02" },
  ]),
}));

vi.mock("@/lib/server/publicCatalog", () => ({
  getPublicProdutos: vi.fn(async () => [
    {
      id: "prod-1",
      slug: "agua-sanitaria-2l",
      is_active: true,
    },
    {
      id: "prod-2",
      slug: "desinfetante-lavanda-5l",
      is_active: true,
    },
    {
      id: "prod-3-inativo",
      slug: "produto-fora-de-linha",
      is_active: false, // CA-06: inativo
    },
  ]),
}));

describe("Sitemap Dinâmico (CA-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inclui rotas fixas, artigos, guias e apenas produtos ativos (exclui inativos)", async () => {
    const mockContext = {
      site: new URL("https://falcaolimpeza.com.br"),
    } as any;

    const response = await getSitemap(mockContext);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const xml = await response.text();

    // Rotas fixas
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/produtos</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/loja</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/empresas</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/privacidade</loc>");

    // Produtos ativos constam no sitemap
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/produtos/agua-sanitaria-2l</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/produtos/desinfetante-lavanda-5l</loc>");

    // CA-06: Produto inativo NÃO deve constar no sitemap
    expect(xml).not.toContain("produto-fora-de-linha");

    // Guias e artigos
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/artigos/artigo-teste-1</loc>");
    expect(xml).toContain("<loc>https://falcaolimpeza.com.br/guias/guia-limpeza-pos-obra</loc>");
  });
});
