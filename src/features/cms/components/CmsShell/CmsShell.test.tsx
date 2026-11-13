// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { CmsShell } from "./CmsShell";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../context/CmsAuthContext", () => ({
  useCmsAuth: () => ({
    session: { name: "Admin Falcão", email: "admin@falcaolimpeza.com.br", photoUrl: "" },
    logout: vi.fn(),
  }),
}));
vi.mock("../../services/cmsAuth.service", () => ({ updateCmsProfilePhoto: vi.fn() }));
vi.mock("../../services/cmsUpload.service", () => ({ uploadCmsImage: vi.fn() }));

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

it("destaca a rota atual, exibe navegacao da Falcão Limpeza sem seletor multissite e persiste a troca de tema", async () => {
  history.replaceState(null, "", "/cms/metricas");
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <BrowserRouter>
        <CmsShell title="Métricas"><main>Conteúdo</main></CmsShell>
      </BrowserRouter>,
    );
  });

  expect(container.querySelector('a[aria-label="Falcão Limpeza CMS"]')?.textContent).toContain("FALCÃO");
  expect(container.querySelector('a[href="/cms/produtos"]')?.textContent).toContain("Produtos");
  expect(container.querySelector('a[href="/cms/ofertas"]')?.textContent).toContain("Ofertas");
  expect(container.querySelector('a[href="/cms/departamentos"]')?.textContent).toContain("Departamentos");
  expect(container.querySelector('a[href="/cms/kits"]')?.textContent).toContain("Kits");
  expect(container.querySelector('a[href="/cms/promocoes"]')?.textContent).toContain("Promoções");
  expect(container.querySelector('a[href="/cms/guias"]')?.textContent).toContain("Guias de limpeza");
  expect(container.querySelector('a[href="/cms/depoimentos"]')?.textContent).toContain("Depoimentos");
  expect(container.querySelector('a[href="/cms/configuracoes"]')?.textContent).toContain("Dados da loja");
  expect(container.querySelector('[role="group"][aria-label="Site"]')).toBeNull();
  expect(container.querySelector('a[href="/cms/metricas"]')?.getAttribute("aria-current")).toBe("page");
  expect(container.querySelector("[data-theme]")?.getAttribute("data-theme")).toBe("light");
  const themeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Alternar tema"]');
  expect(themeButton).not.toBeNull();

  await act(async () => themeButton?.click());

  expect(localStorage.getItem("cms-theme")).toBe("dark");
});
