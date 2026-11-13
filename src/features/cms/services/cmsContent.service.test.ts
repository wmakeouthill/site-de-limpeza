import { afterEach, expect, it, vi } from "vitest";
import { listCmsContent } from "./cmsContent.service";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends the site filter as a query param when provided", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await listCmsContent({ contentType: "case", site: "talimpo" });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("site=talimpo"),
    expect.anything(),
  );
});

it("maps the site field from the response", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          total: 1,
          items: [
            {
              id: "1",
              site: "talimpo",
              content_type: "case",
              status: "draft",
              slug: "s",
              title: "t",
              excerpt: "",
              updated_at: null,
              published_at: null,
              detail_label: "Escola",
            },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);

  const result = await listCmsContent({ contentType: "case", site: "talimpo" });

  expect(result.items[0].site).toBe("talimpo");
});
