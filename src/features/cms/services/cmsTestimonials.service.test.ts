import { afterEach, expect, it, vi } from "vitest";

import {
  createCmsTestimonial,
  deleteCmsTestimonial,
  listCmsTestimonials,
  reorderCmsTestimonials,
} from "./cmsTestimonials.service";

afterEach(() => vi.unstubAllGlobals());

const RESPONSE = {
  id: "abc",
  site: "falcao",
  author: "Eduardo Loyola",
  role: "",
  company: "WLM",
  quote: "Time excelente.",
  youtube_id: "",
  avatar_url: "",
  sort_order: 0,
  is_active: true,
};

it("converte o depoimento de snake_case para camelCase ao listar", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify([RESPONSE]), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const listed = await listCmsTestimonials("falcao");

  expect(listed[0]).toMatchObject({ company: "WLM", isActive: true, sortOrder: 0 });
  expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/cms/testimonials?site=falcao");
});

it("envia o depoimento em snake_case ao criar", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(RESPONSE), { status: 201 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await createCmsTestimonial({
    site: "falcao",
    author: "Eduardo Loyola",
    role: "",
    company: "WLM",
    quote: "Time excelente.",
    youtubeId: "",
    avatarUrl: "",
    isActive: true,
  });

  const [, init] = fetchMock.mock.calls[0];
  expect(JSON.parse(init?.body as string)).toMatchObject({
    youtube_id: "",
    avatar_url: "",
    is_active: true,
  });
});

it("reordena e remove depoimentos", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  await reorderCmsTestimonials("falcao", ["b", "a"]);
  await deleteCmsTestimonial("abc");

  const [, initReorder] = fetchMock.mock.calls[0];
  expect(JSON.parse(initReorder?.body as string)).toEqual({
    site: "falcao",
    ids: ["b", "a"],
  });
  const [, initDelete] = fetchMock.mock.calls[1];
  expect(initDelete).toMatchObject({ method: "DELETE" });
});
