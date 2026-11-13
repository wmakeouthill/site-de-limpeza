import { describe, expect, it } from "vitest";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { filterAndSortProducts, normalizeText } from "./productSearch";

const mockProdutos: PublicProduto[] = [
  {
    id: "p1",
    departamento_id: "dep-1",
    departamento_nome: "Lavanderia",
    departamento_slug: "lavanderia",
    nome: "Água Sanitária 2 L",
    slug: "agua-sanitaria-2l",
    marca: "Clarim",
    tamanho: "2 L",
    descricao: "Alveja, desinfeta e limpa caixas d'água",
    como_usar: "Diluir 1 copo em 10L",
    forma: "garrafa",
    cor: "#003399",
    imagem_url: null,
    preco_de: "8.50",
    preco_por: "6.90",
    promo_ativa: true,
    desconto_pct: 19,
    preco_atual: "6.90",
    embalagem_grande: false,
    ordem: 1,
  },
  {
    id: "p2",
    departamento_id: "dep-1",
    departamento_nome: "Lavanderia",
    departamento_slug: "lavanderia",
    nome: "Sabão em Pó Concentrado 1 kg",
    slug: "sabao-em-po-1kg",
    marca: "Fortex",
    tamanho: "1 kg",
    descricao: "Remove manchas difíceis sem desbotar",
    como_usar: "1 dosador por máquina",
    forma: "caixa",
    cor: "#3AAFA9",
    imagem_url: null,
    preco_de: "18.00",
    preco_por: null,
    promo_ativa: false,
    desconto_pct: null,
    preco_atual: "18.00",
    embalagem_grande: false,
    ordem: 2,
  },
  {
    id: "p3",
    departamento_id: "dep-2",
    departamento_nome: "Geral",
    departamento_slug: "geral",
    nome: "Desengordurante Pesado Galão 5 L",
    slug: "desengordurante-pesado-5l",
    marca: "Brisanil",
    tamanho: "5 L",
    descricao: "Fórmula profissional para restaurantes e cozinhas",
    como_usar: "Aplicar puro ou diluído",
    forma: "galao",
    cor: "#FFC727",
    imagem_url: null,
    preco_de: "42.00",
    preco_por: "36.00",
    promo_ativa: true,
    desconto_pct: 14,
    preco_atual: "36.00",
    embalagem_grande: true,
    ordem: 3,
  },
];

describe("productSearch (CA-24)", () => {
  it("normaliza texto removendo acentos e convertendo para minúsculas", () => {
    expect(normalizeText("Água SANITÁRIA")).toBe("agua sanitaria");
    expect(normalizeText("Sabão & Detergência")).toBe("sabao & detergencia");
  });

  it("busca 'agua SANITARIA' e localiza 'Água sanitária 2 L' (CA-24)", () => {
    const res = filterAndSortProducts(mockProdutos, { q: "agua SANITARIA" });
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("p1");
  });

  it("exige que todos os termos estejam presentes (AND)", () => {
    // "agua" existe em p1, mas "restaurantes" só em p3. Não deve retornar nada.
    const res = filterAndSortProducts(mockProdutos, { q: "agua restaurantes" });
    expect(res.length).toBe(0);
  });

  it("filtra por faixa de preço", () => {
    // Até R$ 10 -> apenas p1 (R$ 6.90)
    const ate10 = filterAndSortProducts(mockProdutos, { precoRange: "10" });
    expect(ate10.map((p) => p.id)).toEqual(["p1"]);

    // De R$ 10 a R$ 30 -> apenas p2 (R$ 18.00)
    const de10a30 = filterAndSortProducts(mockProdutos, { precoRange: "30" });
    expect(de10a30.map((p) => p.id)).toEqual(["p2"]);

    // Acima de R$ 30 -> apenas p3 (R$ 36.00)
    const acima30 = filterAndSortProducts(mockProdutos, { precoRange: "30+" });
    expect(acima30.map((p) => p.id)).toEqual(["p3"]);
  });

  it("filtra apenas ofertas ativas", () => {
    const ofertas = filterAndSortProducts(mockProdutos, { soOfertas: true });
    expect(ofertas.map((p) => p.id)).toEqual(["p1", "p3"]);
  });

  it("filtra embalagens grandes", () => {
    const grandes = filterAndSortProducts(mockProdutos, { embalagemGrande: true });
    expect(grandes.map((p) => p.id)).toEqual(["p3"]);
  });

  it("ordena por menor preço", () => {
    const ordenados = filterAndSortProducts(mockProdutos, { ordem: "menor" });
    expect(ordenados.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});
