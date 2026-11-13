import { afterEach, expect, it, vi } from "vitest";
import { createCmsCase, updateCmsCase } from "./cmsCase.service";
import type { CmsCasePayload } from "../types/cms.types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE_PAYLOAD: CmsCasePayload = {
  site: "talimpo",
  slug: "case-edu",
  title: "Case de Limpeza",
  excerpt: "",
  bodyMarkdown: "",
  seoTitle: "",
  seoDescription: "",
  topic: "Escola X",
  clientName: "Escola X",
  clientLogoAssetId: null,
  clientLogoUrl: "",
  companyIconAssetId: null,
  companyIconUrl: "",
  screenshotAssetId: null,
  screenshotUrl: "",
  screenshotPosition: { x: 50, y: 50, zoom: 100 },
  metrics: [],
  tags: [],
};

function caseResponse(site: string) {
  return {
    id: "1",
    site,
    status: "draft",
    slug: "case-edu",
    title: "Case de Limpeza",
    excerpt: "",
    body_markdown: "",
    seo_title: "",
    seo_description: "",
    client_name: "Escola X",
    client_logo_asset_id: null,
    client_logo_url: "",
    company_icon_asset_id: null,
    company_icon_url: "",
    screenshot_asset_id: null,
    screenshot_url: "",
    metrics: [],
    tags: [],
  };
}

it("sends site in the create request body", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(caseResponse("talimpo")), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await createCmsCase(BASE_PAYLOAD);

  const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(requestInit.body as string);
  expect(body.site).toBe("talimpo");
  expect(body.seo_title).toBe(BASE_PAYLOAD.title);
  expect(body.seo_description).toBe(BASE_PAYLOAD.excerpt);
});

it("omits site from the update request body, which the API rejects as an extra field", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(caseResponse("talimpo")), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await updateCmsCase("1", BASE_PAYLOAD);

  const [, requestInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(requestInit.body as string);
  expect(requestInit.method).toBe("PUT");
  expect(body).not.toHaveProperty("site");
  expect(body.case_detail.topic).toBe("Escola X");
});

it("shows the invalid fields instead of [object Object] on a 422", async () => {
  const detail = [{ loc: ["body", "case_detail", "topic"], msg: "Field required", type: "missing" }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ detail }), { status: 422 })),
  );

  await expect(updateCmsCase("1", BASE_PAYLOAD)).rejects.toThrow(
    "Dados inválidos: case_detail.topic (Field required).",
  );
});

it("maps site from the create response", async () => {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(caseResponse("talimpo")), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const result = await createCmsCase(BASE_PAYLOAD);

  expect(result.site).toBe("talimpo");
});
