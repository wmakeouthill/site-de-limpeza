// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicGuideProduto } from "@/lib/server/publicContent";
import { GuideIngredientsList } from "./GuideIngredientsList";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockProdutos: PublicGuideProduto[] = [
  {
    id: "gp-1",
    produto_id: "prod-desengordurante",
    nome: "Desengordurante Potente 5L",
    slug: "desengordurante-potente-5l",
    quantidade: 2,
    ordem: 0,
    preco_atual: "29.90",
    preco_de: "35.00",
    preco_por: "29.90",
    is_active: true,
  },
  {
    id: "gp-2",
    produto_id: "prod-fibra",
    nome: "Fibra Pesada Verde",
    slug: "fibra-pesada-verde",
    quantidade: 3,
    ordem: 1,
    preco_atual: "5.50",
    preco_de: "5.50",
    preco_por: null,
    is_active: false, // Inativo
  },
  {
    id: "gp-3",
    produto_id: "prod-cloro",
    nome: "Cloro Ativo 5L",
    slug: "cloro-ativo-5l",
    quantidade: 1,
    ordem: 2,
    preco_atual: "19.90",
    preco_de: "19.90",
    preco_por: null,
    is_active: true,
  },
];

describe("GuideIngredientsList - CA-18", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renderiza produtos com quantidade recomendada e marca inativos como indisponíveis", () => {
    const root = createRoot(container);

    act(() => {
      root.render(<GuideIngredientsList produtos={mockProdutos} />);
    });

    // Produto 1 ativo
    const item1 = container.querySelector('[data-testid="ingredient-item-prod-desengordurante"]');
    expect(item1?.textContent).toContain("Desengordurante Potente 5L");
    expect(item1?.textContent).toContain("2x");
    expect(item1?.textContent).toMatch(/R\$\s29,90/);

    // Produto 2 inativo
    const item2 = container.querySelector('[data-testid="ingredient-item-prod-fibra"]');
    expect(item2?.textContent).toContain("Fibra Pesada Verde");
    expect(item2?.textContent).toContain("3x");
    expect(item2?.querySelector('[data-testid="unavailable-badge"]')?.textContent).toContain(
      "Temporariamente indisponível",
    );
  });

  it("adiciona à lista apenas produtos ativos, incrementando quantidades e abrindo a gaveta (CA-18)", () => {
    // Configura estado inicial da lista no localStorage: já possui 1 unidade do desengordurante
    localStorage.setItem(
      "talimpo-lista",
      JSON.stringify({
        "prod-desengordurante": 1,
        "outro-produto": 5,
      }),
    );

    const openListSpy = vi.fn();
    window.addEventListener("talimpo:open-list", openListSpy);

    const root = createRoot(container);

    act(() => {
      root.render(<GuideIngredientsList produtos={mockProdutos} />);
    });

    const addBtn = container.querySelector('[data-testid="add-all-ingredients-btn"]') as HTMLButtonElement;
    expect(addBtn).not.toBeNull();
    expect(addBtn.disabled).toBe(false);

    act(() => {
      fireEvent.click(addBtn);
    });

    // Verifica que o evento de abrir a lista foi disparado
    expect(openListSpy).toHaveBeenCalled();

    // Lê o localStorage atualizado
    const stored = JSON.parse(localStorage.getItem("talimpo-lista") || "{}");

    // Produto 1 (ativo, qtd 2): tinha 1 + 2 = 3
    expect(stored["prod-desengordurante"]).toBe(3);

    // Produto 3 (ativo, qtd 1): não existia, virou 1
    expect(stored["prod-cloro"]).toBe(1);

    // Produto 2 (inativo, qtd 3): NÃO pode ser adicionado à lista (CA-18)
    expect(stored["prod-fibra"]).toBeUndefined();

    // Item não relacionado mantido
    expect(stored["outro-produto"]).toBe(5);

    window.removeEventListener("talimpo:open-list", openListSpy);
  });

  it("desabilita botão de adicionar se todos os produtos estiverem inativos", () => {
    const onlyInactive: PublicGuideProduto[] = [
      {
        id: "gp-9",
        produto_id: "prod-esgotado",
        nome: "Produto Esgotado",
        slug: "produto-esgotado",
        quantidade: 1,
        ordem: 0,
        preco_atual: "10.00",
        preco_de: "10.00",
        preco_por: null,
        is_active: false,
      },
    ];

    const root = createRoot(container);

    act(() => {
      root.render(<GuideIngredientsList produtos={onlyInactive} />);
    });

    const addBtn = container.querySelector('[data-testid="add-all-ingredients-btn"]') as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });
});
