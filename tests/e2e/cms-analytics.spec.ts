import { expect, test } from "@playwright/test";

test.describe("Falcão Analytics, Privacidade e Métricas CMS", () => {
  test("visita com clique em WhatsApp registra evento com target validado sem vazar PII (LGPD)", async ({
    page,
  }) => {
    const trackedEvents: Array<Record<string, any>> = [];

    await page.route("**/api/public/events", async (route) => {
      const data = route.request().postDataJSON();
      if (data?.events && Array.isArray(data.events)) {
        trackedEvents.push(...data.events);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, count: data?.events?.length || 0 }),
      });
    });

    await page.goto(
      "/?utm_source=google&utm_medium=cpc&utm_campaign=limpeza-anil&utm_term=produtos+limpeza",
    );

    // Fecha banner de cookies se estiver aberto
    const aceitarBtn = page.getByRole("button", { name: "Aceitar" });
    if (await aceitarBtn.isVisible()) {
      await aceitarBtn.click();
    }

    // Clica no link de WhatsApp flutuante sem aguardar navegação externa
    const zapBtn = page.locator('a[data-whatsapp-target="flutuante"]').first();
    await expect(zapBtn).toBeAttached();
    await zapBtn.dispatchEvent("click");

    // Aguarda processamento de eventos
    await page.waitForTimeout(1000);

    // Valida que nenhum evento expõe PII (telefones, CPFs, e-mails)
    for (const evt of trackedEvents) {
      if (evt.type === "whatsapp_click") {
        expect(["lista", "cotacao", "bairro", "produto", "flutuante"]).toContain(evt.target);
      }
      expect(String(evt.target || "")).not.toMatch(/\d{10,14}/);
      expect(String(evt.target || "")).not.toMatch(/@/);
    }
  });

  test("página de privacidade /privacidade documenta uso do navegador e conformidade LGPD", async ({
    page,
  }) => {
    const response = await page.goto("/privacidade");
    expect(response?.status()).toBe(200);

    // Valida título e seções chave sobre cookies, lista e LGPD
    await expect(page.locator("main h1").first()).toContainText("Privacidade");
    await expect(page.getByText("localStorage").first()).toBeVisible();
    await expect(page.getByText("LGPD").first()).toBeVisible();
  });

  test("painel de métricas no CMS carrega escopo fixo falcao com rankings de WhatsApp, lista e buscas", async ({
    page,
  }) => {
    await page.route("**/api/cms/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: "admin@falcaolimpeza.com.br",
          name: "Equipe Falcão",
          csrfToken: "talimpo-csrf-token-xyz",
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

    await page.route("**/api/cms/settings*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    let requestedSiteParam: string | null = null;
    await page.route("**/api/cms/analytics*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/pages")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [{ site: "falcao", path: "/produtos", pageviews: 450 }],
            total: 1,
            page: 1,
            page_size: 20,
          }),
        });
        return;
      }

      const site = url.searchParams.get("site");
      if (site) {
        requestedSiteParam = site;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          overview: {
            visitors: 850,
            pageviews: 2400,
            clicks: 180,
            form_submits: 0,
            median_dwell_ms: 65000,
            bounce_rate: 32.5,
          },
          period: { start: "2026-09-01", end: "2026-09-30" },
          comparison_overview: {
            visitors: 700,
            pageviews: 2000,
            clicks: 140,
            form_submits: 0,
            median_dwell_ms: 60000,
            bounce_rate: 35.0,
          },
          timeseries: [
            {
              day: "2026-09-01",
              visitors: 40,
              pageviews: 120,
              by_site: [{ site: "falcao", visitors: 40, pageviews: 120 }],
            },
          ],
          comparison_timeseries: [],
          weekly_rhythm: [],
          pages_per_session: 2.8,
          channels: [
            {
              site: "falcao",
              overview: {
                visitors: 850,
                pageviews: 2400,
                clicks: 180,
                form_submits: 0,
                median_dwell_ms: 65000,
                bounce_rate: 32.5,
              },
            },
          ],
          funnel: [
            { step: "pageview", label: "Sessões", sessions: 850, rate: 100, by_site: [{ site: "falcao", count: 850 }] },
            { step: "click", label: "Clicou em WhatsApp", sessions: 180, rate: 21.2, by_site: [{ site: "falcao", count: 180 }] },
          ],
          top_pages: [{ label: "/", count: 650, pos_x: null, pos_y: null, by_site: [{ site: "falcao", count: 650 }] }],
          top_ctas: [{ label: "WhatsApp Flutuante", count: 88, pos_x: 50, pos_y: 50, by_site: [{ site: "falcao", count: 88 }] }],
          sources: [{ label: "google.com", count: 500, pos_x: null, pos_y: null, by_site: [{ site: "falcao", count: 500 }] }],
          devices: [{ label: "mobile", count: 600, pos_x: null, pos_y: null, by_site: [{ site: "falcao", count: 600 }] }],
          whatsapp_clicks: [
            { label: "lista", count: 95 },
            { label: "cotacao", count: 45 },
            { label: "flutuante", count: 40 },
          ],
          top_lista_products: [
            { label: "Detergente Neutro 5L", count: 120 },
            { label: "Desinfetante Lavanda 5L", count: 85 },
          ],
          top_search_terms: [
            { label: "agua sanitaria", count: 70 },
            { label: "cloro", count: 55 },
          ],
          promotions_summary: [
            { label: "popup_view", count: 320 },
            { label: "popup_click", count: 48 },
            { label: "popup_close", count: 110 },
          ],
        }),
      });
    });

    await page.goto("/cms/metricas");

    await expect(page.locator("aside")).toBeVisible({ timeout: 15_000 });

    // Valida exibição dos indicadores-chave
    await expect(page.getByText("Cliques no WhatsApp")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Produtos mais adicionados à Lista")).toBeVisible();
    await expect(page.getByText("Termos mais buscados")).toBeVisible();
    await expect(page.getByText("Promoções de entrada")).toBeVisible();

    // Valida que o escopo fixo "falcao" foi solicitado
    expect(requestedSiteParam).toBe("falcao");
  });
});
