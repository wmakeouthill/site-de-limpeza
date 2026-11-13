import type { APIRoute } from "astro";

export const prerender = false;

// Arquivo de verificação do IndexNow: mesma INDEXNOW_KEY que o backend usa no ping.
export const GET: APIRoute = ({ params }) => {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || params.indexnowKey !== key) {
    return new Response(null, { status: 404 });
  }
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
