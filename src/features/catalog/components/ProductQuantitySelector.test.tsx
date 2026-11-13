// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { ProductQuantitySelector } from "./ProductQuantitySelector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockProduto: PublicProduto = {
  id: "prod-xyz",
  departamento_id: "d1",
  departamento_nome: "Lavanderia",
  departamento_slug: "lavanderia",
  nome: "Detergente Concentrado 5L",
  slug: "detergente-concentrado-5l",
  marca: "Clarim",
  tamanho: "5L",
  descricao: "Excelente rendimento",
  como_usar: "Diluir 1 para 10",
  forma: "galao",
  cor: "#003399",
  imagem_url: null,
  preco_de: "25.00",
  preco_por: "20.00",
  promo_ativa: true,
  desconto_pct: 20,
  preco_atual: "20.00",
  embalagem_grande: true,
};

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  localStorage.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

it("incrementa e calcula o subtotal corretamente", async () => {
  await act(async () => {
    createRoot(container).render(<ProductQuantitySelector produto={mockProduto} />);
  });

  const textNormalized = (container.textContent || "").replace(/\u00a0/g, " ");
  expect(textNormalized).toContain("1 × R$ 20,00 = R$ 20,00");

  const incBtn = container.querySelector('button[aria-label="Aumentar quantidade"]') as HTMLButtonElement;
  expect(incBtn).not.toBeNull();

  await act(async () => {
    incBtn.click();
  });

  const updatedText = (container.textContent || "").replace(/\u00a0/g, " ");
  expect(updatedText).toContain("2 × R$ 20,00 = R$ 40,00");
});

it("salva na lista do localStorage e dispara evento", async () => {
  const listenerMock = vi.fn();
  window.addEventListener("talimpo:list-updated", listenerMock);

  await act(async () => {
    createRoot(container).render(<ProductQuantitySelector produto={mockProduto} />);
  });

  const addBtn = container.querySelector(".pd-btn-add") as HTMLButtonElement;
  expect(addBtn.textContent).toBe("Pôr na lista");

  await act(async () => {
    addBtn.click();
  });

  expect(localStorage.getItem("talimpo-lista")).toBe(JSON.stringify({ "prod-xyz": 1 }));
  expect(listenerMock).toHaveBeenCalled();
  expect(addBtn.textContent).toBe("Já está na lista");
});
