// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArticleEditorPage } from "./ArticleEditorPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../context/CmsAuthContext", () => ({
  useCmsAuth: () => ({
    session: {
      email: "editor@falcaolimpeza.com.br",
      name: "Editor Falcão",
      photoUrl: "",
    },
  }),
}));

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

vi.mock("../../services/cmsAuthors.service", () => ({
  listCmsAuthors: vi.fn(async () => []),
}));

vi.mock("../../services/cmsArticle.service", () => ({
  getCmsArticle: vi.fn(async (id: string) => ({
    id,
    site: "falcao",
    status: "draft",
    slug: "artigo-teste",
    title: "Artigo de Teste",
    excerpt: "Resumo",
    bodyMarkdown: "Texto",
    seoTitle: "SEO Title",
    seoDescription: "SEO Desc",
    area: "Dicas",
    categoria: "dicas",
    readingTime: "5 min",
    thumbnailAssetId: null,
    thumbnailUrl: "",
    thumbnailPosition: { x: 50, y: 50, zoom: 100 },
    authorName: "Editor",
    authorEmail: "editor@falcaolimpeza.com.br",
    authorImageUrl: "",
  })),
  createCmsArticle: vi.fn(async (payload) => ({
    id: "new-article-id",
    status: "draft",
    ...payload,
  })),
  updateCmsArticle: vi.fn(async (id, payload) => ({
    id,
    status: "draft",
    ...payload,
  })),
}));

describe("ArticleEditorPage - CA-20", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.clearAllMocks();
  });

  it("exibe aviso editorial obrigatório ao selecionar a categoria 'A gente testou' (CA-20)", async () => {
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/cms/artigos/novo"]}>
          <Routes>
            <Route path="/cms/artigos/novo" element={<ArticleEditorPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    const categoriaSelect = container.querySelector('[data-testid="article-categoria-select"]') as HTMLSelectElement;
    expect(categoriaSelect).not.toBeNull();

    // Inicialmente não deve exibir o aviso
    expect(container.querySelector('[data-testid="editorial-notice-testamos"]')).toBeNull();

    // Seleciona "testamos"
    await act(async () => {
      fireEvent.change(categoriaSelect, { target: { value: "testamos" } });
    });

    // Deve exibir o aviso editorial obrigatório (CA-20)
    const notice = container.querySelector('[data-testid="editorial-notice-testamos"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("Aviso Editorial:");
    expect(notice?.textContent).toContain("A gente testou");
    expect(notice?.textContent).toContain("avaliação prática e honesta realizada pela equipe da Falcão Limpeza na loja");

    // Troca para "dicas"
    await act(async () => {
      fireEvent.change(categoriaSelect, { target: { value: "dicas" } });
    });

    expect(container.querySelector('[data-testid="editorial-notice-testamos"]')).toBeNull();
  });
});
