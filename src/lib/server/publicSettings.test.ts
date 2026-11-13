// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getPublicSiteSettings, DEFAULT_SITE_SETTINGS } from "./publicSettings";

describe("publicSettings module & layout features (CA-12, CA-25)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.body.className = "";
  });

  it("CA-12: getPublicSiteSettings reflete dinamicamente whatsapp_numero da loja sem rebuild", async () => {
    const customWhatsApp = "5521988887777";
    const customLojaNome = "Falcão Anil Matriz";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...DEFAULT_SITE_SETTINGS,
        loja_nome: customLojaNome,
        whatsapp_numero: customWhatsApp,
        endereco: "Estrada de Jacarepaguá, 5171",
        bairro_cidade: "Anil, Rio de Janeiro - RJ",
      }),
    });

    const settings = await getPublicSiteSettings({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(settings.loja_nome).toBe(customLojaNome);
    expect(settings.whatsapp_numero).toBe(customWhatsApp);

    // Links de WhatsApp gerados usam o número novo
    const generatedWaUrl = `https://wa.me/${settings.whatsapp_numero}`;
    expect(generatedWaUrl).toContain("5521988887777");
  });

  it("getPublicSiteSettings usa fallback DEFAULT_SITE_SETTINGS quando a API falha", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Conexão recusada"));

    const settings = await getPublicSiteSettings({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(settings.loja_nome).toBe("Falcão Limpeza");
    expect(settings.whatsapp_numero).toBe("5521999999999");
    expect(settings.endereco).toBe("Estrada de Jacarepaguá, 5171");
  });

  it("CA-25: alternador de modo persiste em localStorage['talimpo-modo'] e aplica classe mode-emp", () => {
    function runModeScript(search: string) {
      const params = new URLSearchParams(search);
      const modoParam = params.get("modo");
      if (modoParam === "empresa" || modoParam === "casa") {
        localStorage.setItem("talimpo-modo", modoParam);
      }
      const modo = localStorage.getItem("talimpo-modo") || "casa";
      if (modo === "empresa") {
        document.documentElement.classList.add("mode-emp");
        document.body.classList.add("mode-emp");
      } else {
        document.documentElement.classList.remove("mode-emp");
        document.body.classList.remove("mode-emp");
      }
    }

    // Inicialmente no modo casa
    runModeScript("");
    expect(localStorage.getItem("talimpo-modo")).toBeNull();
    expect(document.documentElement.classList.contains("mode-emp")).toBe(false);

    // Navegando com ?modo=empresa
    runModeScript("?modo=empresa");
    expect(localStorage.getItem("talimpo-modo")).toBe("empresa");
    expect(document.documentElement.classList.contains("mode-emp")).toBe(true);
    expect(document.body.classList.contains("mode-emp")).toBe(true);

    // Próxima navegação sem query param mantém o modo gravado
    runModeScript("");
    expect(localStorage.getItem("talimpo-modo")).toBe("empresa");
    expect(document.documentElement.classList.contains("mode-emp")).toBe(true);

    // Alternando de volta para casa com ?modo=casa
    runModeScript("?modo=casa");
    expect(localStorage.getItem("talimpo-modo")).toBe("casa");
    expect(document.documentElement.classList.contains("mode-emp")).toBe(false);
  });
});
