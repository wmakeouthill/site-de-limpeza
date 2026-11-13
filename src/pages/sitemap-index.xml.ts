import type { APIRoute } from "astro";
import { getPublicSiteSettings } from "@/lib/server/publicContent";

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

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = (site?.toString() || "https://falcaolimpeza.com.br").replace(/\/+$/, "");

  try {
    await getPublicSiteSettings();

    const today = new Date().toISOString().split("T")[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escapeXml(`${baseUrl}/sitemap.xml`)}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

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
