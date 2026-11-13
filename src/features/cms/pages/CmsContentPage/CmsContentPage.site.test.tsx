// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CmsContentPage } from "./CmsContentPage";
import type { CmsContentList } from "../../types/cms.types";
import { clearCmsQueryCache } from "../../hooks/cmsQueryCache";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({
    children,
    primaryAction,
  }: {
    children: React.ReactNode;
    primaryAction?: { label: string; href: string } | null;
  }) => (
    <>
      {primaryAction ? <a href={primaryAction.href}>{primaryAction.label}</a> : null}
      {children}
    </>
  ),
}));

const listMock = vi.fn(async (_filters: unknown): Promise<CmsContentList> => ({
  items: [],
  total: 0,
}));
vi.mock("../../services/cmsContent.service", () => ({
  listCmsContent: (filters: unknown) => listMock(filters),
}));

afterEach(() => {
  document.body.innerHTML = "";
  listMock.mockClear();
  clearCmsQueryCache();
  vi.unstubAllEnvs();
});

it("busca guias com site=falcao em /cms/guias e aponta novo guia para /cms/guias/novo", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/cms/guias"]}>
        <CmsContentPage />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(listMock).toHaveBeenLastCalledWith(
    expect.objectContaining({ site: "falcao", contentType: "case" }),
  );

  const newGuideLink = container.querySelector('a[href="/cms/guias/novo"]');
  expect(newGuideLink).not.toBeNull();
  expect(newGuideLink?.textContent).toContain("Novo guia");
});

it("aponta guias publicados para /guias/:slug", async () => {
  listMock.mockResolvedValueOnce({
    items: [
      {
        id: "guide-1",
        site: "falcao",
        contentType: "case",
        status: "published",
        slug: "defesa-busca-apreensao",
        title: "Guia Busca e Apreensao",
        excerpt: "",
        updatedAt: "2026-07-08T12:00:00Z",
        publishedAt: "2026-07-08T12:00:00Z",
        detailLabel: "Penal Econômico",
      },
    ],
    total: 1,
  });

  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/cms/guias"]}>
        <CmsContentPage />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const previewLink = container.querySelector<HTMLAnchorElement>(
    'a[aria-label="Visualizar Guia Busca e Apreensao"]',
  );

  expect(previewLink?.getAttribute("href")).toBe("/guias/defesa-busca-apreensao");
});

it("aponta artigos publicados para /artigos/:slug", async () => {
  listMock.mockResolvedValueOnce({
    items: [
      {
        id: "article-1",
        site: "falcao",
        contentType: "article",
        status: "published",
        slug: "inquerito-policial-defesa",
        title: "Artigo Inquerito Policial",
        excerpt: "",
        updatedAt: "2026-07-10T12:00:00Z",
        publishedAt: "2026-07-10T12:00:00Z",
        detailLabel: "Direito Penal",
      },
    ],
    total: 1,
  });

  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/cms/artigos"]}>
        <CmsContentPage />
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    container
      .querySelector<HTMLAnchorElement>('a[aria-label="Visualizar Artigo Inquerito Policial"]')
      ?.getAttribute("href"),
  ).toBe("/artigos/inquerito-policial-defesa");
});
