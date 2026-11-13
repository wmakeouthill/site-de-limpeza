// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { CmsContentList } from "../types/cms.types";
import { listCmsContent } from "../services/cmsContent.service";
import { clearCmsQueryCache } from "./cmsQueryCache";
import { useCmsContent } from "./useCmsContent";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../services/cmsContent.service", () => ({ listCmsContent: vi.fn() }));

const LIST: CmsContentList = {
  items: [
    {
      id: "a1",
      site: "falcao",
      contentType: "article",
      status: "published",
      slug: "hello",
      title: "Hello",
      excerpt: "",
      updatedAt: null,
      publishedAt: null,
      detailLabel: "",
    },
  ],
  total: 1,
};

function Probe() {
  const state = useCmsContent({ contentType: "article", searchTerm: "", site: "falcao" });
  return <output data-loading={String(state.isLoading)}>{state.items.map((item) => item.title).join(",")}</output>;
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  clearCmsQueryCache();
  vi.mocked(listCmsContent).mockReset();
});

it("reexibe o conteudo em cache no primeiro render, sem loading", async () => {
  vi.mocked(listCmsContent).mockResolvedValue(LIST);
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(<Probe />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(container.querySelector("output")?.textContent).toBe("Hello");
  expect(listCmsContent).toHaveBeenCalledTimes(1);

  const loadingReads: string[] = [];
  function RemountProbe() {
    const state = useCmsContent({ contentType: "article", searchTerm: "", site: "falcao" });
    loadingReads.push(String(state.isLoading));
    return <output>{state.items.map((item) => item.title).join(",")}</output>;
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
  expect(document.querySelector("output")?.textContent).toBe("Hello");
  expect(listCmsContent).toHaveBeenCalledTimes(1);
});
