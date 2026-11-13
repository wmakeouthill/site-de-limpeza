// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { PublicDepartamento, PublicProduto } from "@/lib/server/publicCatalog";
import { ProductCatalog } from "./ProductCatalog";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockDepartamentos: PublicDepartamento[] = [
  { id: "d1", nome: "Lavanderia", slug: "lavanderia", icone: "shirt", ordem: 1 },
  { id: "d2", nome: "Cozinha", slug: "cozinha", icone: "pot", ordem: 2 },
];

const mockProdutos: PublicProduto[] = [
  {
    id: "p1",
    departamento_id: "d1",
    departamento_nome: "Lavanderia",
    departamento_slug: "lavanderia",
    nome: "Água Sanitária 2 L",
    slug: "agua-sanitaria-2l",
    marca: "Clarim",
    tamanho: "2 L",
    descricao: "Alveja e desinfeta",
    como_usar: "Diluir em água",
    forma: "garrafa",
    cor: "#003399",
    imagem_url: null,
    preco_de: "8.50",
    preco_por: "6.90",
    promo_ativa: true,
    desconto_pct: 19,
    preco_atual: "6.90",
    embalagem_grande: false,
  },
  {
    id: "p2",
    departamento_id: "d2",
    departamento_nome: "Cozinha",
    departamento_slug: "cozinha",
    nome: "Detergente Neutro 500 ml",
    slug: "detergente-neutro-500ml",
    marca: "Fortex",
    tamanho: "500 ml",
    descricao: "Limpeza de louças e gorduras",
    como_usar: "Aplicar na esponja",
    forma: "garrafa",
    cor: "#FFC727",
    imagem_url: null,
    preco_de: "2.80",
    preco_por: null,
    promo_ativa: false,
    desconto_pct: null,
    preco_atual: "2.80",
    embalagem_grande: false,
  },
];

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = "";
});

it("renderiza a lista de produtos e o contador com aria-live", async () => {
  await act(async () => {
    createRoot(container).render(
      <ProductCatalog initialProdutos={mockProdutos} departamentos={mockDepartamentos} />
    );
  });

  expect(container.textContent).toContain("2 produtos encontrados");
  expect(container.textContent).toContain("Água Sanitária 2 L");
  expect(container.textContent).toContain("Detergente Neutro 500 ml");
});

it("filtra produtos por busca textual case-insensitive e sem acento", async () => {
  await act(async () => {
    createRoot(container).render(
      <ProductCatalog initialProdutos={mockProdutos} departamentos={mockDepartamentos} />
    );
  });

  const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
  expect(searchInput).not.toBeNull();

  await act(async () => {
    // Busca "agua SANITARIA" (CA-24)
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(searchInput, "agua SANITARIA");
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    searchInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(container.textContent).toContain("Água Sanitária 2 L");
  expect(container.textContent).not.toContain("Detergente Neutro 500 ml");
  expect(container.textContent).toContain("1 produto encontrado");
});
