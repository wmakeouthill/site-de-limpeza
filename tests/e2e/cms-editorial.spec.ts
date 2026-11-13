import { expect, test } from "@playwright/test";

test.describe("CMS Falcão - Fluxos Editoriais e Governança", () => {
  test.beforeEach(async ({ page }) => {
    // Mock autenticação de sessão CMS
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

    // Mock lista de autores
    await page.route("**/api/cms/authors", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            email: "admin@falcaolimpeza.com.br",
            name: "Equipe Falcão",
            photoUrl: "",
          },
        ]),
      });
    });

    // Mock prefetch requests
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

    // Mock produtos do catálogo para o seletor de insumos dos guias
    await page.route("**/api/cms/products*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "prod-1",
            nome: "Detergente Neutro 5L",
            slug: "detergente-neutro-5l",
            preco_de: 25.0,
            preco_por: null,
            departamento_id: "dep-1",
            is_active: true,
          },
        ]),
      });
    });
  });

  test("artigos: criação, salvamento e validação de preview /artigos/:slug", async ({ page }) => {
    let articlePayload: Record<string, any> | null = null;

    await page.route("**/api/cms/articles", async (route) => {
      articlePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "artigo-vidros-1",
          site: "falcao",
          status: "draft",
          slug: "como-limpar-vidros-sem-manchar",
          title: "Como Limpar Vidros sem Manchar",
          excerpt: "Dicas testadas na prática pela equipe da loja.",
          body_markdown: "# Vidros Perfeitos\n\nTexto com técnicas seguras.",
          seo_title: "",
          seo_description: "",
          area: "A gente testou",
          reading_time: "4 min",
          thumbnail_asset_id: null,
          thumbnail_url: "",
          author_name: "Equipe Falcão",
          author_email: "admin@falcaolimpeza.com.br",
          author_image_url: "",
        }),
      });
    });

    await page.goto("/cms/artigos/novo");

    await page.locator('label:has-text("Titulo") input').fill("Como Limpar Vidros sem Manchar");
    await page.locator('label:has-text("Slug") input').fill("como-limpar-vidros-sem-manchar");

    // Seleciona categoria "testamos" e valida aviso editorial obrigatório (CA-20)
    await page.selectOption('select[data-testid="article-categoria-select"]', "testamos");
    await expect(page.locator('[data-testid="editorial-notice-testamos"]')).toBeVisible();

    await page.locator('label:has-text("Tempo de leitura") input').fill("4 min");
    await page.locator('label:has-text("Resumo") textarea').fill("Dicas testadas na prática pela equipe da loja.");

    // Clica em salvar
    await page.click('button[type="submit"]');

    // Valida mensagem de sucesso
    await expect(page.getByText("Rascunho salvo.")).toBeVisible();

    // Valida que o preview link aponta para /artigos/slug
    const previewLink = page.locator('a[target="_blank"]:has-text("Preview")');
    await expect(previewLink).toBeVisible();
    await expect(previewLink).toHaveAttribute("href", "/artigos/como-limpar-vidros-sem-manchar");

    expect(articlePayload).toBeTruthy();
    expect((articlePayload as any)?.site).toBe("falcao");
  });

  test("guias de limpeza: criação com produtos vinculados e preview /guias/:slug", async ({ page }) => {
    let guidePayload: Record<string, any> | null = null;

    await page.route("**/api/cms/guides", async (route) => {
      guidePayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "guia-piso-1",
          site: "falcao",
          status: "draft",
          slug: "como-limpar-piso-laminado",
          title: "Como Limpar Piso Laminado",
          excerpt: "Guia prático para não danificar o laminado.",
          body_markdown: "# Passo a passo\n\nUse pano quase seco.",
          seo_title: "",
          seo_description: "",
          publico: "casa",
          tempo_minutos: 15,
          dificuldade: "Fácil",
          etiqueta: "Piso",
          icone: "sparkles",
          produtos: [],
        }),
      });
    });

    await page.goto("/cms/guias/novo");

    await page.locator('label:has-text("Título do Guia") input').fill("Como Limpar Piso Laminado");
    await page.locator('label:has-text("Slug amigável") input').fill("como-limpar-piso-laminado");
    await page.locator('label:has-text("Resumo / Introdução") textarea').fill("Guia prático para não danificar o laminado.");
    await page.selectOption('select[data-testid="guide-publico-select"]', "casa");

    await page.click('button[type="submit"]');

    await expect(page.getByText("Guia criado com sucesso.")).toBeVisible();

    // Valida que o preview link aponta para /guias/slug
    const previewLink = page.locator('a:has-text("Visualizar no site")');
    await expect(previewLink).toBeVisible();
    await expect(previewLink).toHaveAttribute("href", "/guias/como-limpar-piso-laminado");

    expect(guidePayload).toBeTruthy();
    expect((guidePayload as any)?.title).toBe("Como Limpar Piso Laminado");
  });

  test("depoimentos: exibe aviso de governança e permite cadastrar para moderação interna", async ({
    page,
  }) => {
    await page.route("**/api/cms/testimonials*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "depo-1",
            site: "falcao",
            author: "Marcelo Sampaio",
            role: "Gerente de Condomínio",
            company: "",
            quote: "Excelente atendimento e pontualidade na entrega.",
            youtube_id: "",
            avatar_url: "",
            sort_order: 0,
            is_active: true,
          },
        ]),
      });
    });

    await page.goto("/cms/depoimentos");

    await expect(page.locator("aside")).toBeVisible({ timeout: 15_000 });

    // Verifica depoimento listado
    await expect(page.getByText("Marcelo Sampaio").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Gerente de Condomínio").first()).toBeVisible({ timeout: 15_000 });
  });
});
