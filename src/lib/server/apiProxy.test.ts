// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyApi, proxyMedia } from "./apiProxy";
import { ALL as apiCatchAll } from "@/pages/api/[...path]";
import { GET as mediaCatchAll } from "@/pages/media/[...path]";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("proxyApi", () => {
  it("rejects a path outside the API allowlist", async () => {
    const request = new Request("https://talimpo.test/api/unlisted");
    const response = await proxyApi(request, "/api/unlisted");
    expect(response.status).toBe(404);
  });

  it("rejects path traversal and internal cache routes outside the allowlist", async () => {
    const traversalReq = new Request("https://talimpo.test/api/cms/../internal/cache/invalidate", {
      method: "POST",
    });
    const res1 = await proxyApi(traversalReq, "/api/cms/../internal/cache/invalidate");
    expect(res1.status).toBe(404);

    const internalReq = new Request("https://talimpo.test/api/internal/cache/invalidate", {
      method: "POST",
    });
    const res2 = await proxyApi(internalReq, "/api/internal/cache/invalidate");
    expect(res2.status).toBe(404);
  });

  it("returns 405 when path is allowlisted but HTTP method is not permitted", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const badDelete = new Request("https://talimpo.test/api/cms/health", { method: "DELETE" });
    const res1 = await proxyApi(badDelete, "/api/cms/health");
    expect(res1.status).toBe(405);

    const badGetUpload = new Request("https://talimpo.test/api/cms/uploads", { method: "GET" });
    const res2 = await proxyApi(badGetUpload, "/api/cms/uploads");
    expect(res2.status).toBe(405);

    const badPutPublic = new Request("https://talimpo.test/api/public/cases", { method: "PUT" });
    const res3 = await proxyApi(badPutPublic, "/api/public/cases");
    expect(res3.status).toBe(405);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("always forwards to fixed API_INTERNAL_URL and ignores forged host headers", async () => {
    vi.stubEnv("API_INTERNAL_URL", "http://127.0.0.1:8000");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://evil.attacker.example/api/cms/health?foo=bar", {
      method: "GET",
      headers: {
        Host: "evil.attacker.example",
        "X-Forwarded-Host": "evil.attacker.example",
      },
    });

    const response = await proxyApi(request, "cms/health");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe("http://127.0.0.1:8000/api/cms/health?foo=bar");
    const forwardedHeaders = new Headers(calledInit.headers);
    expect(forwardedHeaders.get("x-forwarded-host")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves multiple Set-Cookie headers on password login and does not cache", async () => {
    const upstreamHeaders = new Headers();
    upstreamHeaders.append(
      "Set-Cookie",
      "talimpo_cms_access=tok_access; HttpOnly; Path=/; SameSite=Lax",
    );
    upstreamHeaders.append(
      "Set-Cookie",
      "talimpo_cms_refresh=tok_refresh; HttpOnly; Path=/api/cms/auth; SameSite=Lax",
    );
    upstreamHeaders.append("Set-Cookie", "talimpo_cms_csrf=tok_csrf; Path=/; SameSite=Lax");

    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 204,
          headers: upstreamHeaders,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://talimpo.test/api/cms/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "socio@talimpo.test", password: "senha-de-teste-123" }),
    });
    const response = await proxyApi(request, "/api/cms/auth/login");

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.getSetCookie()).toEqual([
      "talimpo_cms_access=tok_access; HttpOnly; Path=/; SameSite=Lax",
      "talimpo_cms_refresh=tok_refresh; HttpOnly; Path=/api/cms/auth; SameSite=Lax",
      "talimpo_cms_csrf=tok_csrf; Path=/; SameSite=Lax",
    ]);
  });

  it("does not follow upstream redirects on the server and returns Location header", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(null, {
          status: 307,
          headers: { Location: "https://elsewhere.test/somewhere" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://talimpo.test/api/cms/auth/me");
    const response = await proxyApi(request, "/api/cms/auth/me");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.redirect).toBe("manual");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://elsewhere.test/somewhere");
  });

  it("rejects the removed OAuth callback route", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://talimpo.test/api/cms/auth/callback?code=x&state=y");
    const response = await proxyApi(request, "/api/cms/auth/callback");

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves binary bytes of Excel .xlsx export without corruption", async () => {
    const xlsxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x89, 0xab, 0xcd]);
    const fetchMock = vi.fn(
      async () =>
        new Response(xlsxBytes, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": 'attachment; filename="contatos.xlsx"',
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://talimpo.test/api/cms/contacts/export?urgent=true");
    const response = await proxyApi(request, "/api/cms/contacts/export");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const receivedBytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(receivedBytes)).toEqual(Array.from(xlsxBytes));
  });

  it("rejects request bodies exceeding route limits with 413", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Public route limit: 64 KiB
    const oversizedPublicBody = "x".repeat(65 * 1024);
    const pubReq = new Request("https://talimpo.test/api/public/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedPublicBody,
    });
    const pubRes = await proxyApi(pubReq, "/api/public/contact");
    expect(pubRes.status).toBe(413);

    // CMS mutation limit: 512 KiB
    const oversizedCmsBody = "x".repeat(520 * 1024);
    const cmsReq = new Request("https://talimpo.test/api/cms/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedCmsBody,
    });
    const cmsRes = await proxyApi(cmsReq, "/api/cms/articles");
    expect(cmsRes.status).toBe(413);

    // Upload limit: 6 MiB (test via Content-Length header and/or buffer)
    const uploadReq = new Request("https://talimpo.test/api/cms/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=---boundary",
        "Content-Length": String(6 * 1024 * 1024 + 1024),
      },
      body: new Uint8Array(16),
    });
    const uploadRes = await proxyApi(uploadReq, "/api/cms/uploads");
    expect(uploadRes.status).toBe(413);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502/503 when upstream fails or times out", async () => {
    const networkErrorFetch = vi.fn(async () => {
      throw new TypeError("fetch failed: ECONNREFUSED");
    });
    vi.stubGlobal("fetch", networkErrorFetch);

    const req1 = new Request("https://talimpo.test/api/public/articles");
    const res1 = await proxyApi(req1, "/api/public/articles");
    expect([502, 503]).toContain(res1.status);

    const abortErrorFetch = vi.fn(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });
    vi.stubGlobal("fetch", abortErrorFetch);

    const req2 = new Request("https://talimpo.test/api/public/articles");
    const res2 = await proxyApi(req2, "/api/public/articles");
    expect([502, 503, 504]).toContain(res2.status);
  });

  it("works through the Astro API route handler", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://talimpo.test/api/cms/health");
    const response = await apiCatchAll({
      request,
      params: { path: "cms/health" },
    } as never);

    expect(response.status).toBe(200);
  });
});

describe("proxyMedia", () => {
  it("rejects path traversal and nested paths with 400 or 404", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res1 = await proxyMedia(
      new Request("https://talimpo.test/media/../secret.webp"),
      "../secret.webp",
    );
    expect([400, 404]).toContain(res1.status);

    const res2 = await proxyMedia(
      new Request("https://talimpo.test/media/sub/image.webp"),
      "sub/image.webp",
    );
    expect([400, 404]).toContain(res2.status);

    const res3 = await proxyMedia(
      new Request("https://talimpo.test/media/..%2fsecret.png"),
      "..%2fsecret.png",
    );
    expect([400, 404]).toContain(res3.status);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects .svg files with 415 Unsupported Media Type", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await proxyMedia(
      new Request("https://talimpo.test/media/vector.svg"),
      "vector.svg",
    );
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves valid raster image with X-Content-Type-Options: nosniff", async () => {
    const imageBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
    const fetchMock = vi.fn(
      async () =>
        new Response(imageBytes, {
          status: 200,
          headers: { "Content-Type": "image/webp" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await mediaCatchAll({
      request: new Request("https://talimpo.test/media/a1b2c3d4.webp"),
      params: { path: "a1b2c3d4.webp" },
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("image/webp");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(body)).toEqual(Array.from(imageBytes));
  });
});
