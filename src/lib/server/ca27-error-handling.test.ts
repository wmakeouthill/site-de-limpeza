// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyApi } from "./apiProxy";
import { getPublicSiteSettings, DEFAULT_SITE_SETTINGS } from "./publicSettings";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CA-27: Tratamento de erros e indisponibilidade da API", () => {
  it("retorna status 503 sem vazar detalhes técnicos quando a API está fora do ar", async () => {
    // Simula erro de conexão/API offline (ex: ECONNREFUSED)
    const fetchMock = vi.fn(async () => {
      const err = new TypeError("fetch failed: connect ECONNREFUSED 127.0.0.1:8000");
      (err as any).code = "ECONNREFUSED";
      throw err;
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://falcaolimpeza.com.br/api/public/site-settings");
    const response = await proxyApi(request, "/api/public/site-settings");

    expect(response.status).toBe(503);

    const bodyText = await response.text();
    const bodyJson = JSON.parse(bodyText);

    // Mensagem amigável padronizada
    expect(bodyJson.detail).toBe("Serviço temporariamente indisponível.");

    // Verifica estritamente que NÃO vazam dados técnicos, IPs ou stack traces
    expect(bodyText).not.toContain("ECONNREFUSED");
    expect(bodyText).not.toContain("127.0.0.1");
    expect(bodyText).not.toContain("8000");
    expect(bodyText).not.toContain("backend");
    expect(bodyText).not.toContain("TypeError");
    expect(bodyText).not.toContain("stack");
  });

  it("retorna status 503 amigável em caso de timeout ao consultar a API", async () => {
    const abortMock = vi.fn(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", abortMock);

    const request = new Request("https://falcaolimpeza.com.br/api/public/articles");
    const response = await proxyApi(request, "/api/public/articles");

    expect(response.status).toBe(503);

    const bodyText = await response.text();
    const bodyJson = JSON.parse(bodyText);

    expect(bodyJson.detail).toBe("Tempo limite excedido ao consultar a API.");
    expect(bodyText).not.toContain("AbortError");
    expect(bodyText).not.toContain("stack");
  });

  it("getPublicSiteSettings provê fallback gracioso com DEFAULT_SITE_SETTINGS quando a API falha", async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error("API offline");
    });

    const settings = await getPublicSiteSettings({ fetchFn: failingFetch });
    expect(settings).toEqual(DEFAULT_SITE_SETTINGS);
    expect(settings.loja_nome).toBe("Falcão Limpeza");
    expect(settings.whatsapp_numero).toBe("5521999999999");
  });
});
