import { afterEach, expect, it, vi } from "vitest";

import { clearCmsQueryCache, peekCmsQuery, readCmsQuery } from "./cmsQueryCache";

afterEach(() => {
  clearCmsQueryCache();
});

it("reutiliza o valor em cache sem chamar o fetcher de novo", async () => {
  const fetcher = vi.fn(async () => 7);

  expect(await readCmsQuery("n", fetcher)).toBe(7);
  expect(await readCmsQuery("n", fetcher)).toBe(7);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(peekCmsQuery("n")).toBe(7);
});

it("repete a busca quando force=true", async () => {
  const fetcher = vi.fn(async () => 1);
  await readCmsQuery("n", fetcher);
  fetcher.mockResolvedValueOnce(2);

  expect(await readCmsQuery("n", fetcher, true)).toBe(2);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
