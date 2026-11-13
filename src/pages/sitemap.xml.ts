import type { APIRoute } from "astro";
import {
  getPublicArticlesList,
  getPublicGuidesList,
  getPublicSiteSettings,
} from "@/lib/server/publicContent";
import { getPublicProdutos } from "@/lib/server/publicCatalog";

export const prerender = false;

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return new Date().toISOString().split("T")[0];
  try {
    return new Date(isoString).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = (site?.toString() || "https://falcaolimpeza.com.br").replace(/\/+$/, "");

  try {
    const settings = await getPublicSiteSettings();

    const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
      { loc: `${baseUrl}/`, changefreq: "weekly", priority: "1.0" },
      { loc: `${baseUrl}/produtos`, changefreq: "daily", priority: "0.9" },
      { loc: `${baseUrl}/loja`, changefreq: "monthly", priority: "0.8" },
      { loc: `${baseUrl}/empresas`, changefreq: "monthly", priority: "0.8" },
      { loc: `${baseUrl}/privacidade`, changefreq: "monthly", priority: "0.3" },
    ];

    // CA-06: Apenas produtos ativos entram no sitemap. Produtos inativos são sumariamente excluídos.
    try {
      const produtos = await getPublicProdutos();
      for (const p of produtos) {
        if ((p as any).is_active !== false) {
          urls.push({
            loc: `${baseUrl}/produtos/${p.slug}`,
            changefreq: "weekly",
            priority: "0.8",
          });
        }
      }
    } catch {
      // catálogo indisponível não derruba sitemap de rotas fixas
    }

    if (settings.articles_enabled) {
      urls.push({ loc: `${baseUrl}/artigos`, changefreq: "daily", priority: "0.8" });
      const articles = await getPublicArticlesList();
      for (const article of articles) {
        urls.push({
          loc: `${baseUrl}/artigos/${article.slug}`,
          lastmod: formatDate(article.first_published_at),
          changefreq: "monthly",
          priority: "0.7",
        });
      }
    }

    if (settings.guides_enabled) {
      urls.push({ loc: `${baseUrl}/guias`, changefreq: "daily", priority: "0.8" });
      const guides = await getPublicGuidesList();
      for (const guide of guides) {
        urls.push({
          loc: `${baseUrl}/guias/${guide.slug}`,
          lastmod: formatDate(guide.first_published_at),
          changefreq: "monthly",
          priority: "0.7",
        });
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${
      u.changefreq ? `\n    <changefreq>${u.changefreq}</changefreq>` : ""
    }${u.priority ? `\n    <priority>${u.priority}</priority>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (_err) {
    return new Response("503 Service Unavailable: Falcão editorial API unreachable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }
};
