import { afterEach, expect, it, vi } from "vitest";

import {
  deleteCmsCampaignLink,
  listCmsCampaignLinks,
  upsertCmsCampaignLink,
} from "./cmsCampaignLinks.service";

afterEach(() => vi.unstubAllGlobals());

it("converte e grava uma ficha de origem de campanha pelo identificador", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
    identifier: "reel-agosto-01",
    title: "Reel: agentes de IA",
    source_url: "https://www.instagram.com/reel/ABC123/",
    thumbnail_url: "https://cdn.example.com/reel-agosto-01.jpg",
    redirect_url: "https://bit.ly/exemplo",
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const saved = await upsertCmsCampaignLink("reel-agosto-01", {
    title: "Reel: agentes de IA",
    sourceUrl: "https://www.instagram.com/reel/ABC123/",
    thumbnailUrl: "https://cdn.example.com/reel-agosto-01.jpg",
    redirectUrl: "https://bit.ly/exemplo",
  });

  expect(saved.sourceUrl).toBe("https://www.instagram.com/reel/ABC123/");
  expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/cms/campaign-links/reel-agosto-01");
  expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
    source_url: "https://www.instagram.com/reel/ABC123/",
  });
});

it("lista e remove fichas de campanha", async () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return new Response(JSON.stringify([{ identifier: "reel-01", title: "Reel", source_url: "https://www.instagram.com/reel/1/", thumbnail_url: "", redirect_url: "" }]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  expect((await listCmsCampaignLinks())[0]?.identifier).toBe("reel-01");
  await deleteCmsCampaignLink("reel-01");

  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "DELETE" });
});
