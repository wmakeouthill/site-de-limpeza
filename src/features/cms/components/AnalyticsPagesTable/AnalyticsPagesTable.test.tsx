// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { AnalyticsPagesTable } from "./AnalyticsPagesTable";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("lista a rota do Edu por canal real e pagina os resultados", async () => {
  const onPageChange = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <AnalyticsPagesTable
        pages={{
          items: [{ site: "talimpo", path: "/cases/case-limpeza-industrial", pageviews: 1 }],
          total: 21,
          page: 1,
          pageSize: 20,
        }}
        isLoading={false}
        errorMessage={null}
        onPageChange={onPageChange}
      />,
    );
  });

  expect(container.textContent).toContain("Todas as páginas vistas");
  expect(container.textContent).toContain("Falcão");
  expect(container.textContent).toContain("/cases/case-limpeza-industrial");

  await act(async () => {
    [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Próxima")
      ?.click();
  });
  expect(onPageChange).toHaveBeenCalledWith(2);
});
