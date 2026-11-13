// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { CaseEditorPage } from "./CaseEditorPage";
import type { CmsCase } from "../../types/cms.types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../components/ImageUploadField", () => ({
  ImageUploadField: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("../../components/ImagePositionControl", () => ({
  ImagePositionControl: () => <div>Controle de posicao</div>,
}));
vi.mock("../../components/MarkdownEditor", () => ({
  MarkdownEditor: () => <div>Editor markdown</div>,
}));

const CASE_ENTRY: CmsCase = {
  id: "guide-1",
  site: "falcao",
  status: "published",
  slug: "defesa-operacao-policial",
  title: "Guia Operacao Policial",
  excerpt: "Resumo do guia",
  bodyMarkdown: "Conteudo",
  seoTitle: "",
  seoDescription: "",
  topic: "Penal Econômico",
  clientName: "Penal Econômico",
  clientLogoAssetId: null,
  clientLogoUrl: "",
  companyIconAssetId: null,
  companyIconUrl: "",
  screenshotAssetId: null,
  screenshotUrl: "https://cdn.example/guide.png",
  screenshotPosition: { x: 35, y: 45, zoom: 120 },
  metrics: [
    { prefix: "+", value: "24h", label: "resposta imediata" },
    { prefix: "", value: "STJ", label: "jurisprudencia" },
  ],
  tags: [{ label: "Defesa Criminal" }],
};

const getCmsCaseMock = vi.fn(async (_caseId: string) => CASE_ENTRY);
vi.mock("../../services/cmsCase.service", () => ({
  getCmsCase: (caseId: string) => getCmsCaseMock(caseId),
  createCmsCase: vi.fn(),
  updateCmsCase: vi.fn(),
  publishCmsCase: vi.fn(),
  unarchiveCmsCase: vi.fn(),
  unpublishCmsCase: vi.fn(),
}));

afterEach(() => {
  document.body.innerHTML = "";
  getCmsCaseMock.mockClear();
  vi.unstubAllEnvs();
});

it("abre o preview publico do guia em /guias/:slug", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/cms/guias/guide-1"]}>
        <Routes>
          <Route path="/cms/guias/:id" element={<CaseEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const previewLink = container.querySelector<HTMLAnchorElement>('a[target="_blank"]');

  expect(previewLink?.getAttribute("href")).toBe("/guias/defesa-operacao-policial");
});

it("renderiza o preview do card do guia apontando para /guias/:slug", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/cms/guias/guide-1"]}>
        <Routes>
          <Route path="/cms/guias/:id" element={<CaseEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const previewButton = Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("Preview do card"),
  );
  expect(previewButton).toBeTruthy();

  await act(async () => {
    previewButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog?.textContent).toContain("Guia Operacao Policial");
  const cardLink = dialog?.querySelector<HTMLAnchorElement>('a[href="/guias/defesa-operacao-policial"]');
  expect(cardLink).not.toBeNull();
});