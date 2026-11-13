import type { APIRoute } from "astro";
import { proxyMedia } from "@/lib/server/apiProxy";

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  const path = params.path ?? "";
  return proxyMedia(request, path);
};
