import type { APIRoute } from "astro";
import { proxyApi } from "@/lib/server/apiProxy";

export const prerender = false;

export const ALL: APIRoute = async ({ request, params }) => {
  const path = params.path ?? "";
  return proxyApi(request, `/api/${path}`);
};
