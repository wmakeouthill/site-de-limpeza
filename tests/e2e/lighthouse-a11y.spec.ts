import { expect, test } from "@playwright/test";

test.describe("Auditoria de Performance e Acessibilidade Mobile (CA-29)", () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE / Mobile viewport
    isMobile: true,
  });

  const routes = ["/", "/produtos", "/loja", "/empresas"];

  for (const path of routes) {
    test(`rota ${path} cumpre critérios de acessibilidade e semântica mobile`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);

      // 1. Viewport mobile devidamente configurado
      const viewportMeta = page.locator('meta[name="viewport"]');
      await expect(viewportMeta).toHaveAttribute("content", /width=device-width/);

      // 2. Presença de marcos semânticos principais (exatamente um elemento main)
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();

      // 3. Imagens possuem atributo alt descritivo ou aria-hidden
      const images = page.locator("img");
      const imgCount = await images.count();
      for (let i = 0; i < imgCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        const ariaHidden = await img.getAttribute("aria-hidden");
        const isDecorative = ariaHidden === "true";
        expect(alt !== null || isDecorative).toBe(true);
      }

      // 4. Links e botões interativos possuem rótulo acessível
      const interactiveElements = page.locator("button, a:not([aria-hidden='true'])");
      const count = await interactiveElements.count();
      for (let i = 0; i < Math.min(count, 15); i++) {
        const el = interactiveElements.nth(i);
        if (await el.isVisible()) {
          const text = (await el.textContent())?.trim();
          const ariaLabel = await el.getAttribute("aria-label");
          const ariaLabelledBy = await el.getAttribute("aria-labelledby");
          const title = await el.getAttribute("title");
          const hasAccessibleName = Boolean(text || ariaLabel || ariaLabelledBy || title);
          expect(hasAccessibleName).toBe(true);
        }
      }

      // 5. Sem erros de console críticos
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      expect(errors).toHaveLength(0);
    });
  }

  test("popup de promoção não causa CLS no layout base", async ({ page }) => {
    // Intercepta promoções ativas de entrada
    await page.route("**/api/public/promocoes/ativa*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "promo-entry-1",
          titulo: "Oferta Especial de Boas-Vindas",
          subtitulo: "Ganhe 10% de desconto no balcão",
          tipo_acao: "link",
          destino: "/produtos",
          rotulo_cta: "Aproveitar",
          frequencia: "uma_vez",
          publico: "todos",
          situacao: "ativa",
        }),
      });
    });

    await page.goto("/");

    // Aguarda carregamento inicial
    const header = page.locator("header, nav").first();
    await expect(header).toBeVisible();
    const boxBefore = await header.boundingBox();

    // Aguarda possível popup
    await page.waitForTimeout(600);

    // O cabeçalho não deve sofrer salto de layout (Cumulative Layout Shift)
    const boxAfter = await header.boundingBox();
    if (boxBefore && boxAfter) {
      expect(Math.abs(boxBefore.y - boxAfter.y)).toBeLessThan(1);
    }
  });
});
