// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CmsGuide, CmsProduto } from "../../types/cms.types";
import { GuideEditorPage } from "./GuideEditorPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/MarkdownEditor", () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const mockProdutos: CmsProduto[] = [
  {
    id: "prod-1",
    departamento_id: "dep-1",
    departamento_nome: "Cozinha",
    departamento_slug: "cozinha",
    nome: "Desengordurante Potente 5L",
    slug: "desengordurante-potente-5l",
    marca: "Falcão",
    tamanho: "5L",
    descricao: "Ideal para chapas",
    como_usar: "Aplicar puro",
    forma: "galao",
    cor: "#003399",
    imagem_url: null,
    imagem_posicao: "center",
    imagem_zoom: 100,
    preco_de: "35.00",
    preco_por: "29.90",
    promo_inicio: null,
    promo_fim: null,
    promo_ativa: true,
    desconto_pct: 14,
    preco_atual: "29.90",
    embalagem_grande: true,
    ordem: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod-2",
    departamento_id: "dep-1",
    departamento_nome: "Cozinha",
    departamento_slug: "cozinha",
    nome: "Fibra Pesada Verde",
    slug: "fibra-pesada-verde",
    marca: "Falcão",
    tamanho: "Unidade",
    descricao: "Limpeza pesada",
    como_usar: "Usar com luvas",
    forma: "esponja",
    cor: "#047857",
    imagem_url: null,
    imagem_posicao: "center",
    imagem_zoom: 100,
    preco_de: "5.50",
    preco_por: null,
    promo_inicio: null,
    promo_fim: null,
    promo_ativa: false,
    desconto_pct: null,
    preco_atual: "5.50",
    embalagem_grande: false,
    ordem: 1,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const createdGuides: any[] = [];

vi.mock("../../services/cmsCatalog.service", () => ({
  listCmsProdutos: vi.fn(async () => mockProdutos),
}));

vi.mock("../../services/cmsGuide.service", () => ({
  getCmsGuide: vi.fn(async (id: string): Promise<CmsGuide> => ({
    id,
    site: "falcao",
    status: "draft",
    slug: "guia-existente",
    title: "Guia Existente",
    excerpt: "Resumo do guia",
    bodyMarkdown: "Passo 1...",
    seoTitle: "SEO Title",
    seoDescription: "SEO Desc",
    coverAssetId: null,
    publico: "empresa",
    tempoMinutos: 20,
    etiqueta: "Chapa",
    icone: "pot",
    dificuldade: "Média",
    produtos: [
      {
        id: "gp-1",
        produto_id: "prod-1",
        nome: "Desengordurante Potente 5L",
        slug: "desengordurante-potente-5l",
        quantidade: 2,
        ordem: 0,
        preco_atual: "29.90",
        preco_de: "35.00",
        preco_por: "29.90",
        is_active: true,
      },
    ],
    authorName: "Equipe",
    authorEmail: null,
    authorImageUrl: "",
  })),
  createCmsGuide: vi.fn(async (payload) => {
    createdGuides.push(payload);
    return {
      id: "guide-new-id",
      status: "draft",
      ...payload,
    };
  }),
  updateCmsGuide: vi.fn(async (id, payload) => ({
    id,
    status: "draft",
    ...payload,
  })),
  publishCmsGuide: vi.fn(async (id) => ({
    id,
    status: "published",
  })),
  unpublishCmsGuide: vi.fn(async (id) => ({
    id,
    status: "draft",
  })),
  archiveCmsGuide: vi.fn(async (id) => ({
    id,
    status: "archived",
  })),
  unarchiveCmsGuide: vi.fn(async (id) => ({
    id,
    status: "draft",
  })),
  deleteCmsGuide: vi.fn(async () => {}),
}));

describe("GuideEditorPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it("renderiza formulário de novo guia e adiciona/remove insumos à lista", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/cms/guias/novo"]}>
          <Routes>
            <Route path="/cms/guias/novo" element={<GuideEditorPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    // Verifica presença dos campos principais
    const titleInput = container.querySelector("input[required]") as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    const publicoSelect = container.querySelector('[data-testid="guide-publico-select"]') as HTMLSelectElement;
    expect(publicoSelect).not.toBeNull();

    // Preenche título
    fireEvent.change(titleInput, { target: { value: "Como Limpar Chapa" } });

    // Adiciona produto ao guia
    const productSelect = container.querySelector('[data-testid="product-select"]') as HTMLSelectElement;
    expect(productSelect).not.toBeNull();
    fireEvent.change(productSelect, { target: { value: "prod-1" } });

    const qtdInput = container.querySelector('[data-testid="product-qtd-input"]') as HTMLInputElement;
    fireEvent.change(qtdInput, { target: { value: "3" } });

    const addBtn = container.querySelector('[data-testid="add-product-btn"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(addBtn);
    });

    const productsList = container.querySelector('[data-testid="guide-products-list"]');
    expect(productsList?.textContent).toContain("Desengordurante Potente 5L");
    expect(productsList?.textContent).toContain("Qtd: 3x");
    expect(productsList?.textContent).toContain("Ativo");

    // Remove produto
    const removeBtn = container.querySelector('[data-testid="remove-prod-prod-1"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(productsList?.textContent).not.toContain("Desengordurante Potente 5L");
  });

  it("carrega guia existente com produtos vinculados", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/cms/guias/guide-123"]}>
          <Routes>
            <Route path="/cms/guias/:id" element={<GuideEditorPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Guia Existente");
    expect(container.textContent).toContain("Desengordurante Potente 5L");
    expect(container.textContent).toContain("Qtd: 2x");
  });
});
