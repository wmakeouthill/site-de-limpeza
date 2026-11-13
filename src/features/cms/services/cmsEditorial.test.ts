// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentRenderer } from "@/features/content/components/ContentRenderer";
import { setCmsCsrfToken } from "./cmsAuth.service";
import { createCmsCase, getCmsCase } from "./cmsCase.service";
import {
  createCmsTestimonial,
  deleteCmsTestimonial,
  listCmsTestimonials,
  reorderCmsTestimonials,
  updateCmsTestimonial,
} from "./cmsTestimonials.service";
import { uploadCmsImage } from "./cmsUpload.service";
import type { CmsCasePayload } from "../types/cms.types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Falcão Editorial - Guias de Defesa (cmsCase.service)", () => {
  const VALID_PAYLOAD: CmsCasePayload = {
    site: "falcao",
    slug: "operacoes-policiais",
    title: "Guia de Defesa em Operações Policiais",
    excerpt: "Garantias processuais no inquérito e flagrante.",
    bodyMarkdown: "Texto completo do guia.",
    seoTitle: "Defesa em Operações Policiais",
    seoDescription: "Garantias processuais.",
    topic: "Direito Penal Econômico",
    screenshotAssetId: "asset-123",
    screenshotUrl: "https://cdn.falcaolimpeza.com.br/guia.png",
    screenshotPosition: { x: 50, y: 50, zoom: 100 },
    tags: [{ label: "Operações Policiais" }, { label: "Flagrante" }],
  };

  it("exige campo topic obrigatório e rejeita quando vazio", async () => {
    const invalidPayload: CmsCasePayload = {
      ...VALID_PAYLOAD,
      topic: "",
      clientName: "",
    };

    await expect(createCmsCase(invalidPayload)).rejects.toThrow(
      "O campo Tema / Área Penal é obrigatório.",
    );
  });

  it("envia topic em case_detail e omite client_name, logos e metrics", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "guide-1",
            site: "falcao",
            status: "draft",
            slug: "operacoes-policiais",
            title: "Guia de Defesa em Operações Policiais",
            excerpt: "Garantias processuais.",
            body_markdown: "Texto",
            seo_title: "",
            seo_description: "",
            topic: "Direito Penal Econômico",
            screenshot_asset_id: "asset-123",
            screenshot_url: "https://cdn.falcaolimpeza.com.br/guia.png",
            tags: [{ label: "Flagrante", sort_order: 0 }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createCmsCase(VALID_PAYLOAD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);

    expect(body.site).toBe("falcao");
    expect(body.case_detail.topic).toBe("Direito Penal Econômico");
    // Garante que não envia logos de cliente nem metrics
    expect(body.case_detail.client_name).toBeUndefined();
    expect(body.case_detail.client_logo_asset_id).toBeUndefined();
    expect(body.case_detail.client_logo_url).toBeUndefined();
    expect(body.case_detail.company_icon_asset_id).toBeUndefined();
    expect(body.metrics).toBeUndefined();
  });

  it("mapeia topic e tags na resposta do getCmsCase", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "guide-1",
            site: "falcao",
            status: "published",
            slug: "operacoes-policiais",
            title: "Guia de Defesa",
            excerpt: "Resumo",
            body_markdown: "Corpo",
            seo_title: "",
            seo_description: "",
            topic: "Direito Penal Econômico",
            screenshot_asset_id: "asset-1",
            screenshot_url: "https://cdn.example/capa.jpg",
            screenshot_position_x: 40,
            screenshot_position_y: 60,
            screenshot_zoom: 110,
            tags: [{ label: "Habeas Corpus", sort_order: 1 }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const guide = await getCmsCase("guide-1");

    expect(guide.id).toBe("guide-1");
    expect(guide.topic).toBe("Direito Penal Econômico");
    expect(guide.screenshotPosition).toEqual({ x: 40, y: 60, zoom: 110 });
    expect(guide.tags[0].label).toBe("Habeas Corpus");
  });
});

describe("Falcão Editorial - Sanitização HTML no ContentRenderer", () => {
  it("bloqueia tags perigosas como script, iframe e atributos inline como onerror", async () => {
    const maliciousMarkdown = `
# Título do Guia

Texto seguro com [link legítimo](https://falcaolimpeza.com.br).

<script>alert("xss")</script>
<iframe src="https://malicious.example.com"></iframe>
<img src="https://falcaolimpeza.com.br/logo.png" onerror="alert('hack')" alt="Logo" />
<a href="javascript:alert(1)">Clique aqui</a>
`;

    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(createElement(ContentRenderer, { markdown: maliciousMarkdown }));
      await Promise.resolve();
    });

    const html = container.innerHTML;

    // Tags perigosas foram expurgadas
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("alert(");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");

    // Conteúdo seguro foi preservado
    expect(container.textContent).toContain("Título do Guia");
    expect(container.textContent).toContain("Texto seguro");
  });
});

describe("Falcão Editorial - Upload de Mídia (cmsUpload.service)", () => {
  it("rejeita arquivos .svg por motivos de segurança", async () => {
    const svgFile = new File(["<svg></svg>"], "imagem.svg", { type: "image/svg+xml" });
    await expect(uploadCmsImage(svgFile)).rejects.toThrow(
      "Arquivos SVG não são permitidos por motivos de segurança.",
    );
  });

  it("rejeita arquivos maiores que 5MB", async () => {
    const largeSize = 5 * 1024 * 1024 + 10;
    const largeFile = new File([new ArrayBuffer(largeSize)], "foto-grande.png", {
      type: "image/png",
    });

    await expect(uploadCmsImage(largeFile)).rejects.toThrow(
      "Arquivo excede o limite máximo permitido de 5MB.",
    );
  });

  it("envia X-CSRF-Token no upload de arquivo válido", async () => {
    setCmsCsrfToken("talimpo-csrf-secret-999");

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: "https://cdn.falcaolimpeza.com.br/foto.png",
            filename: "foto.png",
            asset_id: "asset-99",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const validFile = new File(["fake-image-bytes"], "foto.png", { type: "image/png" });
    const result = await uploadCmsImage(validFile);

    expect(result.url).toBe("https://cdn.falcaolimpeza.com.br/foto.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBe("talimpo-csrf-secret-999");
  });
});

describe("Falcão Editorial - Serviço de Depoimentos (cmsTestimonials.service)", () => {
  it("executa CRUD no escopo falcao", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/api/cms/testimonials?site=falcao")) {
        return new Response(
          JSON.stringify([
            {
              id: "test-1",
              site: "falcao",
              author: "Dr. Rogério",
              role: "Empresário",
              company: "Grupo ABC",
              quote: "Atuação de excelência técnica.",
              youtube_id: "",
              avatar_url: "",
              sort_order: 0,
              is_active: true,
            },
          ]),
          { status: 200 },
        );
      }

      if (url.endsWith("/api/cms/testimonials") && method === "POST") {
        const body = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: "test-2",
            ...body,
            youtube_id: body.youtube_id || "",
            avatar_url: body.avatar_url || "",
            sort_order: 1,
            is_active: body.is_active ?? true,
          }),
          { status: 201 },
        );
      }

      if (url.includes("/api/cms/testimonials/test-1") && method === "PUT") {
        const body = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            id: "test-1",
            ...body,
            youtube_id: "",
            avatar_url: "",
            sort_order: 0,
            is_active: true,
          }),
          { status: 200 },
        );
      }

      if (url.includes("/api/cms/testimonials/test-1") && method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    // List
    const items = await listCmsTestimonials("falcao");
    expect(items).toHaveLength(1);
    expect(items[0].author).toBe("Dr. Rogério");

    // Create
    const created = await createCmsTestimonial({
      site: "falcao",
      author: "Dra. Carolina",
      role: "Diretora Jurídica",
      company: "Indústria XYZ",
      quote: "Defesa criminal impecável.",
      youtubeId: "",
      avatarUrl: "",
      isActive: true,
    });
    expect(created.id).toBe("test-2");
    expect(created.author).toBe("Dra. Carolina");

    // Update
    const updated = await updateCmsTestimonial("test-1", {
      site: "falcao",
      author: "Dr. Rogério Atualizado",
      role: "Empresário",
      company: "Grupo ABC",
      quote: "Atuação atualizada.",
      youtubeId: "",
      avatarUrl: "",
      isActive: true,
    });
    expect(updated.author).toBe("Dr. Rogério Atualizado");

    // Delete
    await expect(deleteCmsTestimonial("test-1")).resolves.toBeUndefined();
  });

  it("reordena depoimentos enviando site e lista de IDs", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await reorderCmsTestimonials("falcao", ["t2", "t1", "t3"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/cms/testimonials/reorder");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      site: "falcao",
      ids: ["t2", "t1", "t3"],
    });
  });
});
