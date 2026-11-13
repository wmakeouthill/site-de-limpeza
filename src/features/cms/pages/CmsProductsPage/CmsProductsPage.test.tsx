// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { CmsDepartamento, CmsProduto } from "../../types/cms.types";
import { CmsProductsPage } from "./CmsProductsPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="cms-shell">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const mockDepartamentos: CmsDepartamento[] = [
  {
    id: "dep-1",
    nome: "Lavanderia",
    slug: "lavanderia",
    icone: "shirt",
    ordem: 0,
    is_active: true,
  },
];

const mockProdutos: CmsProduto[] = [
  {
    id: "prod-1",
    nome: "Detergente Neutro 5L",
    slug: "detergente-neutro-5l",
    departamento_id: "dep-1",
    marca: "Falcão",
    tamanho: "5L",
    descricao: "Detergente neutro concentrado",
    como_usar: "Diluir em água",
    forma: "liquido",
    cor: "#003399",
    imagem_url: null,
    imagem_posicao: "center",
    imagem_zoom: 1,
    preco_de: "25.00",
    preco_por: "19.90",
    promo_inicio: null,
    promo_fim: null,
    promo_ativa: true,
    desconto_pct: 20,
    preco_atual: "19.90",
    embalagem_grande: true,
    ordem: 0,
    is_active: true,
  },
  {
    id: "prod-2",
    nome: "Desinfetante Floral 2L",
    slug: "desinfetante-floral-2l",
    departamento_id: "dep-1",
    marca: "Falcão",
    tamanho: "2L",
    descricao: "Desinfetante floral bactericida",
    como_usar: "Aplicar puro",
    forma: "liquido",
    cor: "#FFC727",
    imagem_url: null,
    imagem_posicao: "center",
    imagem_zoom: 1,
    preco_de: "12.00",
    preco_por: null,
    promo_inicio: null,
    promo_fim: null,
    promo_ativa: false,
    desconto_pct: null,
    preco_atual: "12.00",
    embalagem_grande: false,
    ordem: 1,
    is_active: false,
  },
];

const listDepartamentosMock = vi.fn(async () => mockDepartamentos);
const listProdutosMock = vi.fn(async (_params?: unknown) => mockProdutos);
const updateProdutoMock = vi.fn(async (id: string, payload: Partial<CmsProduto>) => {
  const prod = mockProdutos.find((p) => p.id === id);
  return { ...prod, ...payload } as CmsProduto;
});
const deleteProdutoMock = vi.fn(async (_id: string) => {});

vi.mock("../../services/cmsCatalog.service", () => ({
  listCmsDepartamentos: () => listDepartamentosMock(),
  listCmsProdutos: (params: unknown) => listProdutosMock(params),
  updateCmsProduto: (id: string, payload: unknown) =>
    updateProdutoMock(id, payload as Partial<CmsProduto>),
  deleteCmsProduto: (id: string) => deleteProdutoMock(id),
}));

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

it("renderiza a tabela de produtos e departamentos", async () => {
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter>
        <CmsProductsPage />
      </MemoryRouter>
    );
  });

  expect(container.textContent).toContain("Detergente Neutro 5L");
  expect(container.textContent).toContain("Desinfetante Floral 2L");
  expect(container.textContent).toContain("R$ 19.90");
  expect(container.textContent).toContain("R$ 25.00");
  expect(container.textContent).toContain("5L");
  expect(container.textContent).toContain("Grande");
});

it("permite alternar status ativo/inativo", async () => {
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter>
        <CmsProductsPage />
      </MemoryRouter>
    );
  });

  const toggleButtons = container.querySelectorAll("button[title*='desativar'], button[title*='ativar']");
  expect(toggleButtons.length).toBeGreaterThan(0);

  await act(async () => {
    (toggleButtons[0] as HTMLButtonElement).click();
  });

  expect(updateProdutoMock).toHaveBeenCalledWith("prod-1", { is_active: false });
});
