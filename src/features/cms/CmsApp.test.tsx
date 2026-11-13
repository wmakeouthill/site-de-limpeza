// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CmsApp } from "./CmsApp";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("./components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-guard">{children}</div>,
}));

vi.mock("./pages/CmsContentPage", () => ({
  CmsContentPage: () => {
    const loc = useLocation();
    return <div data-testid="content-page">Conteudo ({loc.pathname})</div>;
  },
}));

vi.mock("./pages/ArticleEditorPage", () => ({
  ArticleEditorPage: () => {
    const loc = useLocation();
    return <div data-testid="article-editor">Artigo ({loc.pathname})</div>;
  },
}));

vi.mock("./pages/GuideEditorPage", () => ({
  GuideEditorPage: () => {
    const loc = useLocation();
    return <div data-testid="guide-editor">Guia ({loc.pathname})</div>;
  },
}));

vi.mock("./pages/CmsTestimonialsPage", () => ({
  CmsTestimonialsPage: () => <div data-testid="testimonials-page">Depoimentos</div>,
}));

vi.mock("./pages/CmsAnalyticsPage", () => ({
  CmsAnalyticsPage: () => <div data-testid="analytics-page">Metricas</div>,
}));

vi.mock("./pages/CmsSettingsPage", () => ({
  CmsSettingsPage: () => <div data-testid="settings-page">Configuracoes</div>,
}));

vi.mock("./pages/CmsProductsPage", () => ({
  CmsProductsPage: () => <div data-testid="products-page">Produtos</div>,
}));

vi.mock("./pages/CmsProductEditorPage", () => ({
  CmsProductEditorPage: () => {
    const loc = useLocation();
    return <div data-testid="product-editor">Produto ({loc.pathname})</div>;
  },
}));

vi.mock("./pages/CmsDepartmentsPage", () => ({
  CmsDepartmentsPage: () => <div data-testid="departments-page">Departamentos</div>,
}));

vi.mock("./pages/CmsKitsPage", () => ({
  CmsKitsPage: () => <div data-testid="kits-page">Kits</div>,
}));

vi.mock("./pages/CmsOffersPage", () => ({
  CmsOffersPage: () => <div data-testid="offers-page">Ofertas</div>,
}));

vi.mock("./pages/CmsPromotionsPage", () => ({
  CmsPromotionsPage: () => <div data-testid="promotions-page">Promocoes</div>,
  CmsPromotionEditorPage: () => {
    const loc = useLocation();
    return <div data-testid="promotion-editor">Promocao ({loc.pathname})</div>;
  },
}));

afterEach(() => {
  document.body.innerHTML = "";
});

async function renderApp(initialPath: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={[initialPath]}>
        <CmsApp />
      </MemoryRouter>,
    );
  });
  return container;
}

it("renderiza CmsContentPage em /cms e /cms/conteudo", async () => {
  const c1 = await renderApp("/cms");
  expect(c1.querySelector('[data-testid="content-page"]')?.textContent).toContain("Conteudo (/cms)");

  const c2 = await renderApp("/cms/conteudo");
  expect(c2.querySelector('[data-testid="content-page"]')?.textContent).toContain("Conteudo (/cms/conteudo)");
});

it("renderiza ArticleEditorPage em /cms/artigos/novo e /cms/artigos/:id", async () => {
  const c1 = await renderApp("/cms/artigos/novo");
  expect(c1.querySelector('[data-testid="article-editor"]')?.textContent).toContain("Artigo (/cms/artigos/novo)");

  const c2 = await renderApp("/cms/artigos/art-123");
  expect(c2.querySelector('[data-testid="article-editor"]')?.textContent).toContain("Artigo (/cms/artigos/art-123)");
});

it("renderiza GuideEditorPage em /cms/guias/novo e /cms/guias/:id", async () => {
  const c1 = await renderApp("/cms/guias/novo");
  expect(c1.querySelector('[data-testid="guide-editor"]')?.textContent).toContain("Guia (/cms/guias/novo)");

  const c2 = await renderApp("/cms/guias/guia-456");
  expect(c2.querySelector('[data-testid="guide-editor"]')?.textContent).toContain("Guia (/cms/guias/guia-456)");
});

it("redireciona /cms/cases/* para /cms/guias/*", async () => {
  const c1 = await renderApp("/cms/cases/novo");
  expect(c1.querySelector('[data-testid="guide-editor"]')?.textContent).toContain("Guia (/cms/guias/novo)");

  const c2 = await renderApp("/cms/cases/case-789");
  expect(c2.querySelector('[data-testid="guide-editor"]')?.textContent).toContain("Guia (/cms/guias/case-789)");

  const c3 = await renderApp("/cms/cases");
  expect(c3.querySelector('[data-testid="content-page"]')?.textContent).toContain("Conteudo (/cms/guias)");
});

it("renderiza as secoes de catalogo do CMS", async () => {
  const c1 = await renderApp("/cms/produtos");
  expect(c1.querySelector('[data-testid="products-page"]')).not.toBeNull();

  const c2 = await renderApp("/cms/produtos/novo");
  expect(c2.querySelector('[data-testid="product-editor"]')?.textContent).toContain("Produto (/cms/produtos/novo)");

  const c3 = await renderApp("/cms/produtos/prod-123");
  expect(c3.querySelector('[data-testid="product-editor"]')?.textContent).toContain("Produto (/cms/produtos/prod-123)");

  const c4 = await renderApp("/cms/departamentos");
  expect(c4.querySelector('[data-testid="departments-page"]')).not.toBeNull();

  const c5 = await renderApp("/cms/kits");
  expect(c5.querySelector('[data-testid="kits-page"]')).not.toBeNull();

  const c6 = await renderApp("/cms/ofertas");
  expect(c6.querySelector('[data-testid="offers-page"]')).not.toBeNull();

  const c7 = await renderApp("/cms/promocoes");
  expect(c7.querySelector('[data-testid="promotions-page"]')).not.toBeNull();

  const c8 = await renderApp("/cms/promocoes/nova");
  expect(c8.querySelector('[data-testid="promotion-editor"]')?.textContent).toContain("Promocao (/cms/promocoes/nova)");

  const c9 = await renderApp("/cms/promocoes/promo-123");
  expect(c9.querySelector('[data-testid="promotion-editor"]')?.textContent).toContain("Promocao (/cms/promocoes/promo-123)");
});

it("renderiza as demais secoes do CMS", async () => {
  const c1 = await renderApp("/cms/depoimentos");
  expect(c1.querySelector('[data-testid="testimonials-page"]')).not.toBeNull();

  const c3 = await renderApp("/cms/metricas");
  expect(c3.querySelector('[data-testid="analytics-page"]')).not.toBeNull();

  const c4 = await renderApp("/cms/configuracoes");
  expect(c4.querySelector('[data-testid="settings-page"]')).not.toBeNull();
});

it("redireciona rota desconhecida para /cms", async () => {
  const c1 = await renderApp("/cms/rota-inexistente");
  expect(c1.querySelector('[data-testid="content-page"]')?.textContent).toContain("Conteudo (/cms)");
});
