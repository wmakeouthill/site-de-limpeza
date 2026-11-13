import { describe, expect, it, vi } from "vitest";
import {
  getHomeCatalogData,
  getPublicDepartamentos,
  getPublicProdutoBySlug,
  getPublicProdutos,
} from "./publicCatalog";

describe("publicCatalog service (SSR)", () => {
  it("busca lista de departamentos públicos", async () => {
    const mockDepts = [
      { id: "d1", nome: "Lavanderia", slug: "lavanderia", icone: "shirt", ordem: 1 },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDepts,
    });

    const res = await getPublicDepartamentos({ fetchFn: fetchMock as any });
    expect(res).toEqual(mockDepts);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/departamentos"),
      expect.any(Object)
    );
  });

  it("busca produtos com filtros de query string", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await getPublicProdutos({
      departamento_slug: "cozinha",
      oferta: true,
      q: "desengordurante",
      fetchFn: fetchMock as any,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/public/produtos?departamento_slug=cozinha&q=desengordurante&oferta=true"),
      expect.any(Object)
    );
  });

  it("retorna null se o produto não for encontrado (404)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const res = await getPublicProdutoBySlug("produto-inexistente", { fetchFn: fetchMock as any });
    expect(res).toBeNull();
  });

  it("calcula a menor data de validade em getHomeCatalogData", async () => {
    const mockOfertas = [
      { id: "p1", nome: "Detergente", promo_fim: "2026-10-31T23:59:59Z" },
      { id: "p2", nome: "Sabão", promo_fim: "2026-10-25T23:59:59Z" },
    ];

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/public/departamentos")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.includes("/api/public/produtos")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => mockOfertas });
      }
      if (url.includes("/api/public/kits")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.includes("/api/public/site-settings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            loja_nome: "Falcão Limpeza",
            whatsapp_numero: "5521999999999",
            endereco: "Estrada de Jacarepaguá, 5171",
            bairro_cidade: "Anil, Rio de Janeiro - RJ",
            horarios: [],
            pagamento: "Pix e cartões",
            bairros_entrega: ["Anil"],
            articles_enabled: true,
            guides_enabled: true,
            testimonials_enabled: true,
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const data = await getHomeCatalogData({ fetchFn: fetchMock as any });
    expect(data.ofertas.length).toBe(2);
    expect(data.ofertasValidade).toBeDefined();
    // 25/10 é menor que 31/10
    expect(data.ofertasValidade).toContain("25/10");
  });
});
