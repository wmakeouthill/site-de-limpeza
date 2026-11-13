// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CmsTestimonialsPage } from "./CmsTestimonialsPage";
import { clearCmsQueryCache } from "../../hooks/cmsQueryCache";
import type { CmsTestimonial } from "../../types/cms.types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeTestimonial(overrides: Partial<CmsTestimonial>): CmsTestimonial {
  return {
    id: "id1",
    site: "falcao",
    author: "Dr. Marcelo",
    role: "Diretor Jurídico",
    company: "Empresa XPTO",
    quote: "Excelente atuação técnica em defesa criminal.",
    youtubeId: "",
    avatarUrl: "",
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

const listMock = vi.fn(async (_site: unknown): Promise<CmsTestimonial[]> => []);
const createMock = vi.fn(async (_payload: unknown) => makeTestimonial({}));
const updateMock = vi.fn(async (_id: unknown, _payload: unknown) => makeTestimonial({}));
const deleteMock = vi.fn(async (_id: unknown) => undefined);
const reorderMock = vi.fn(async (_site: unknown, _ids: unknown) => undefined);

vi.mock("../../services/cmsTestimonials.service", () => ({
  listCmsTestimonials: (site: unknown) => listMock(site),
  createCmsTestimonial: (payload: unknown) => createMock(payload),
  updateCmsTestimonial: (id: unknown, payload: unknown) => updateMock(id, payload),
  deleteCmsTestimonial: (id: unknown) => deleteMock(id),
  reorderCmsTestimonials: (site: unknown, ids: unknown) => reorderMock(site, ids),
}));

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    value: vi.fn(),
    configurable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    value: vi.fn(),
    configurable: true,
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  listMock.mockClear();
  createMock.mockClear();
  updateMock.mockClear();
  deleteMock.mockClear();
  reorderMock.mockClear();
  clearCmsQueryCache();
});

async function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<CmsTestimonialsPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

it("permite abrir modal de novo depoimento e criar registro no escopo falcao", async () => {
  listMock.mockResolvedValue([]);
  createMock.mockResolvedValueOnce(makeTestimonial({ author: "Dra. Patrícia" }));
  const container = await renderPage();

  const newButton = container.querySelector<HTMLButtonElement>("button")!;
  expect(newButton.textContent).toContain("Novo depoimento");

  await act(async () => {
    newButton.click();
  });

  const dialog = container.querySelector("dialog");
  expect(dialog).not.toBeNull();
  expect(dialog?.textContent).toContain("Novo depoimento");
  expect(dialog?.textContent).toContain("Autor");
  expect(dialog?.textContent).toContain("Depoimento");
});

it("clicar em ↓ no primeiro de tres itens chama reorderCmsTestimonials com escopo falcao e a nova ordem", async () => {
  const items = [
    makeTestimonial({ id: "id1", author: "Um" }),
    makeTestimonial({ id: "id2", author: "Dois" }),
    makeTestimonial({ id: "id3", author: "Tres" }),
  ];
  listMock.mockResolvedValue(items);
  reorderMock.mockResolvedValue(undefined);
  const container = await renderPage();

  const downButton = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Mover para baixo"]',
  )!;

  await act(async () => {
    downButton.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(reorderMock).toHaveBeenCalledTimes(1);
  expect(reorderMock).toHaveBeenCalledWith("falcao", ["id2", "id1", "id3"]);
});

it("primeiro item nao tem seta para cima e ultimo nao tem seta para baixo", async () => {
  const items = [
    makeTestimonial({ id: "id1", author: "Um" }),
    makeTestimonial({ id: "id2", author: "Dois" }),
    makeTestimonial({ id: "id3", author: "Tres" }),
  ];
  listMock.mockResolvedValue(items);
  const container = await renderPage();

  const rows = container.querySelectorAll("tbody tr");
  expect(rows).toHaveLength(3);
  expect(rows[0].querySelector('button[aria-label="Mover para cima"]')).toBeNull();
  expect(rows[0].querySelector('button[aria-label="Mover para baixo"]')).not.toBeNull();
  expect(rows[2].querySelector('button[aria-label="Mover para baixo"]')).toBeNull();
  expect(rows[2].querySelector('button[aria-label="Mover para cima"]')).not.toBeNull();
});

it("excluir pede confirmacao e nao chama deleteCmsTestimonial se negada", async () => {
  const items = [makeTestimonial({ id: "id1", author: "Um" })];
  listMock.mockResolvedValue(items);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  const container = await renderPage();

  const deleteButton = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Excluir depoimento de Um"]',
  )!;

  await act(async () => {
    deleteButton.click();
    await Promise.resolve();
  });

  expect(confirmSpy).toHaveBeenCalledTimes(1);
  expect(deleteMock).not.toHaveBeenCalled();

  confirmSpy.mockReturnValue(true);
  await act(async () => {
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(deleteMock).toHaveBeenCalledWith("id1");
  confirmSpy.mockRestore();
});

it("mostra erro quando excluir falha", async () => {
  const items = [makeTestimonial({ id: "id1", author: "Um" })];
  listMock.mockResolvedValue(items);
  deleteMock.mockRejectedValueOnce(new Error("Falhou"));
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
  const container = await renderPage();

  const deleteButton = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Excluir depoimento de Um"]',
  )!;

  await act(async () => {
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(container.textContent).toContain("Falhou");
  confirmSpy.mockRestore();
});
