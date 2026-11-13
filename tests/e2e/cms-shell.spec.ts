import { expect, test } from "@playwright/test";

test.describe("CMS Shell e isolamento de bundles", () => {
  test("rota /cms tem noindex, nofollow e estrutura própria sem BaseLayout público", async ({
    page,
  }) => {
    // Mock resposta 401 imediata para simular usuário não autenticado sem depender de timeout TCP
    await page.route("**/api/cms/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Não autenticado" }),
      });
    });

    const response = await page.goto("/cms");
    expect(response?.status()).toBe(200);

    const robotsMeta = page.locator('meta[name="robots"]');
    await expect(robotsMeta).toHaveAttribute("content", "noindex, nofollow");

    await expect(page).toHaveTitle(/Painel Editorial | Falcão Limpeza/);

    // Confirma que não possui elementos da landing pública
    await expect(page.locator("nav#navbar")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(0);

    // Estado inicial não autenticado exibe card de acesso da Falcão
    await expect(page.getByText("FALCÃO LIMPEZA · CMS")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Acesso administrativo")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Entrar no CMS" })).toBeVisible({ timeout: 15_000 });
  });

  test("deep links respondem 200 com noindex", async ({ page }) => {
    const deepLinks = [
      "/cms/conteudo",
      "/cms/artigos/novo",
      "/cms/guias",
      "/cms/guias/novo",
      "/cms/cases",
      "/cms/depoimentos",
      "/cms/produtos",
      "/cms/metricas",
      "/cms/configuracoes",
    ];

    for (const link of deepLinks) {
      const response = await page.goto(link);
      expect(response?.status()).toBe(200);
      const robotsMeta = page.locator('meta[name="robots"]');
      await expect(robotsMeta).toHaveAttribute("content", "noindex, nofollow");
    }
  });

  test("deep link autenticado renderiza shell e navegação do CMS", async ({ page }) => {
    await page.route("**/api/cms/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "advogado@falcaolimpeza.com.br",
          name: "Rodrigo Falcão",
          csrfToken: "mock-csrf-token",
        }),
      });
    });

    await page.route("**/api/cms/content*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });

    await page.goto("/cms/guias");
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("link", { name: "Falcão Limpeza CMS" })).toBeVisible();
    await expect(page.getByText("Guias de limpeza")).toBeVisible();
    await expect(page.getByText("Rodrigo Falcão")).toBeVisible();
  });

  test("home '/' não carrega scripts do BlockNote no bundle inicial", async ({ page }) => {
    const loadedScripts: string[] = [];

    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes(".js") && !url.includes("chrome-extension")) {
        try {
          const text = await res.text();
          loadedScripts.push(text);
        } catch {
          // Ignore responses that cannot be read
        }
      }
    });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Garante que a home carregou os elementos públicos
    await expect(page.locator("body")).toBeVisible();

    // Verifica que nenhum script carregado na home contém referências ao BlockNote
    const hasBlockNote = loadedScripts.some(
      (script) =>
        script.includes("createBlockNote") ||
        script.includes("@blocknote") ||
        script.includes("BlockNoteView"),
    );
    expect(hasBlockNote).toBe(false);
  });
});
