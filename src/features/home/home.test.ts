import { describe, expect, it } from "vitest";
import { getHomeCatalogData } from "@/lib/server/publicCatalog";

describe("Home Page SSR Data", () => {
  it("carrega estrutura vazia de forma segura caso o backend esteja offline", async () => {
    // Com fetch falhando
    const fetchMock = async () => {
      throw new Error("Conexão recusada");
    };

    const data = await getHomeCatalogData({ fetchFn: fetchMock as any, timeoutMs: 100 });
    expect(data.departamentos).toEqual([]);
    expect(data.ofertas).toEqual([]);
    expect(data.ofertasValidade).toBeNull();
    expect(data.settings.loja_nome).toBe("Falcão Limpeza");
  });

  it("calcula oferta em destaque e validade formatada", async () => {
    const fetchMock = async (url: string) => {
      if (url.includes("/api/public/produtos")) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "p1",
              nome: "Água Sanitária 2L",
              slug: "agua-sanitaria-2l",
              preco_de: "7.90",
              preco_por: "5.90",
              promo_ativa: true,
              promo_fim: "2026-10-25T23:59:59Z",
              desconto_pct: 25,
              preco_atual: "5.90",
            },
          ],
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    };

    const data = await getHomeCatalogData({ fetchFn: fetchMock as any });
    expect(data.ofertas.length).toBe(1);
    expect(data.ofertas[0].nome).toBe("Água Sanitária 2L");
    expect(data.ofertasValidade).toContain("25/10");
  });
});
