import { describe, it, expect } from "vitest";
import { buildProductJsonLd, buildStoreJsonLd } from "../utils/jsonLdBuilder";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "@/lib/server/publicSettings";

const MOCK_SETTINGS: PublicSiteSettings = {
  ...DEFAULT_SITE_SETTINGS,
  loja_nome: "Falcão Limpeza",
  whatsapp_numero: "5521999999999",
  endereco: "Estrada do Anil, 450 - Anil, Rio de Janeiro - RJ",
};

describe("SEO JSON-LD Builders (CA-30 / CA-06)", () => {
  describe("buildProductJsonLd (CA-30)", () => {
    it("para produto com oferta ativa: price é o preco_por e priceValidUntil é promo_fim", () => {
      const produtoComOferta: PublicProduto = {
        id: "prod-agua-sanitaria",
        departamento_id: "dept-1",
        nome: "Água Sanitária 2L",
        slug: "agua-sanitaria-2l",
        marca: "Falcão",
        tamanho: "2 L",
        descricao: "Desinfetante clorado para higienização geral",
        como_usar: "Diluir 1 copo em 10 litros",
        forma: "Líquido",
        cor: "#2563eb",
        imagem_url: "https://falcaolimpeza.com.br/img/agua-2l.png",
        preco_de: "12,90",
        preco_por: "9,90",
        promo_inicio: "2026-10-20",
        promo_fim: "2026-10-25",
        promo_ativa: true,
        desconto_pct: 23,
        preco_atual: "9,90",
        embalagem_grande: false,
      };

      const jsonLd = buildProductJsonLd({
        produto: produtoComOferta,
        settings: MOCK_SETTINGS,
        canonicalUrl: "https://falcaolimpeza.com.br/produtos/agua-sanitaria-2l",
      });

      expect(jsonLd["@type"]).toBe("Product");
      expect(jsonLd.name).toBe("Água Sanitária 2L");

      const offer = jsonLd.offers as Record<string, unknown>;
      expect(offer["@type"]).toBe("Offer");
      expect(offer.price).toBe("9.90");
      expect(offer.priceCurrency).toBe("BRL");
      expect(offer.priceValidUntil).toBe("2026-10-25");
      expect(offer.url).toBe("https://falcaolimpeza.com.br/produtos/agua-sanitaria-2l");
    });

    it("para produto com preço regular (sem oferta ativa): price é preco_de e não possui priceValidUntil", () => {
      const produtoRegular: PublicProduto = {
        id: "prod-desinfetante-5l",
        departamento_id: "dept-1",
        nome: "Desinfetante Floral 5L",
        slug: "desinfetante-floral-5l",
        marca: "Falcão",
        tamanho: "5 L",
        descricao: "Desinfetante concentrado",
        como_usar: "Uso puro ou diluído",
        forma: "Líquido",
        cor: "#ec4899",
        imagem_url: null,
        preco_de: "29,90",
        preco_por: null,
        promo_inicio: null,
        promo_fim: null,
        promo_ativa: false,
        desconto_pct: null,
        preco_atual: "29,90",
        embalagem_grande: true,
      };

      const jsonLd = buildProductJsonLd({
        produto: produtoRegular,
        settings: MOCK_SETTINGS,
        canonicalUrl: "https://falcaolimpeza.com.br/produtos/desinfetante-floral-5l",
      });

      const offer = jsonLd.offers as Record<string, unknown>;
      expect(offer.price).toBe("29.90");
      expect(offer.priceValidUntil).toBeUndefined();
    });
  });

  describe("buildStoreJsonLd", () => {
    it("gera dados estruturados com endereço, telefone e horários da loja", () => {
      const jsonLd = buildStoreJsonLd({
        settings: MOCK_SETTINGS,
        canonicalUrl: "https://falcaolimpeza.com.br/",
      });

      expect(jsonLd["@type"]).toBe("Store");
      expect(jsonLd.name).toBe("Falcão Limpeza");
      expect(jsonLd.telephone).toBe("+5521999999999");
      expect(jsonLd.address.streetAddress).toContain("Estrada do Anil, 450");
      expect(jsonLd.openingHoursSpecification).toBeDefined();
    });
  });
});
