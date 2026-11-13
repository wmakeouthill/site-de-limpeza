// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { AnalyticsPageList } from "../types/cms.types";
import { getCmsAnalyticsPages } from "../services/cmsAnalytics.service";
import { clearCmsQueryCache } from "./cmsQueryCache";
import { useCmsAnalyticsPages } from "./useCmsAnalyticsPages";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../services/cmsAnalytics.service", () => ({ getCmsAnalyticsPages: vi.fn() }));

const PERIOD = { from: "2026-08-01", to: "2026-08-19" };
const FIRST_PAGE: AnalyticsPageList = {
  items: [{ site: "falcao", path: "/", pageviews: 12 }], total: 21, page: 1, pageSize: 20,
};
const SECOND_PAGE: AnalyticsPageList = {
  items: [{ site: "talimpo", path: "/cases/industria", pageviews: 3 }], total: 21, page: 2, pageSize: 20,
};

function Probe({ page }: { page: number }) {
  const state = useCmsAnalyticsPages(undefined, PERIOD, page, 20);
  return <output data-loading={String(state.isLoading)} data-fetching={String(state.isFetching)}>{state.pages.items.map((item) => item.path).join(",")}</output>;
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  clearCmsQueryCache();
  vi.mocked(getCmsAnalyticsPages).mockReset();
});

it("mantém a página atual durante a busca e reutiliza uma página já carregada", async () => {
  let resolveSecond!: (value: AnalyticsPageList) => void;
  const secondRequest = new Promise<AnalyticsPageList>((resolve) => { resolveSecond = resolve; });
  vi.mocked(getCmsAnalyticsPages)
    .mockResolvedValueOnce(FIRST_PAGE)
    .mockReturnValueOnce(secondRequest);

  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => { root!.render(<Probe page={1} />); await Promise.resolve(); await Promise.resolve(); });
  expect(container.querySelector("output")?.textContent).toBe("/");
  expect(getCmsAnalyticsPages).toHaveBeenCalledTimes(2);

  await act(async () => { root!.render(<Probe page={2} />); await Promise.resolve(); });
  expect(container.querySelector("output")?.dataset.loading).toBe("false");
  expect(container.querySelector("output")?.dataset.fetching).toBe("true");
  expect(container.querySelector("output")?.textContent).toBe("/");

  await act(async () => { resolveSecond(SECOND_PAGE); await secondRequest; });
  expect(container.querySelector("output")?.textContent).toBe("/cases/industria");

  await act(async () => { root!.render(<Probe page={1} />); await Promise.resolve(); });
  expect(container.querySelector("output")?.textContent).toBe("/");
  expect(getCmsAnalyticsPages).toHaveBeenCalledTimes(2);
});

it("reexibe a pagina em cache no primeiro render, sem loading", async () => {
  vi.mocked(getCmsAnalyticsPages).mockResolvedValue(FIRST_PAGE);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => { root!.render(<Probe page={1} />); await Promise.resolve(); await Promise.resolve(); });
  expect(container.querySelector("output")?.textContent).toBe("/");
  expect(getCmsAnalyticsPages).toHaveBeenCalledTimes(2);

  const loadingReads: string[] = [];
  function RemountProbe() {
    const state = useCmsAnalyticsPages(undefined, PERIOD, 1, 20);
    loadingReads.push(String(state.isLoading));
    return <output>{state.pages.items.map((item) => item.path).join(",")}</output>;
  }

  await act(async () => {
    root!.unmount();
    document.body.innerHTML = "";
    const next = document.createElement("div");
    document.body.appendChild(next);
    root = createRoot(next);
    root.render(<RemountProbe />);
  });

  expect(loadingReads[0]).toBe("false");
  expect(document.querySelector("output")?.textContent).toBe("/");
  expect(getCmsAnalyticsPages).toHaveBeenCalledTimes(2);
});
