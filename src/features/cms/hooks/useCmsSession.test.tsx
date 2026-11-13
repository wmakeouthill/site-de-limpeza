// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { peekCmsQuery, writeCmsQuery } from "./cmsQueryCache";
import { requestCmsJson } from "../services/cmsApi.service";
import {
  clearStoredCmsSession,
  fetchCmsSession,
  peekStoredCmsSession,
} from "../services/cmsAuth.service";
import { useCmsSession } from "./useCmsSession";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
  document.cookie = "talimpo_cms_csrf=; Max-Age=0; path=/";
  clearStoredCmsSession();
  vi.unstubAllGlobals();
});

function stubSessionFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            email: "admin@falcaolimpeza.com.br",
            name: "Rodrigo Falcão",
            csrfToken: "csrf-from-me",
            access_token: "secret-idp-token",
          }),
          { status: 200 },
        ),
    ),
  );
}

it("nao volta para loading no remount quando a sessao ja esta em cache e nao armazena tokens do IdP", async () => {
  stubSessionFetch();
  const session = await fetchCmsSession();
  expect(session).toEqual({
    email: "admin@falcaolimpeza.com.br",
    name: "Rodrigo Falcão",
  });
  expect(session).not.toHaveProperty("access_token");

  const statuses: string[] = [];
  function Probe() {
    const { status } = useCmsSession();
    statuses.push(status);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Probe />);
  });

  expect(statuses[0]).toBe("authenticated");
});

it("envia X-CSRF-Token nas mutacoes a partir do cookie talimpo_cms_csrf ou do /me", async () => {
  document.cookie = "talimpo_cms_csrf=csrf-cookie-123; path=/";
  const fetchSpy = vi.fn(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchSpy);

  await requestCmsJson("/api/cms/articles", {
    method: "POST",
    body: JSON.stringify({ title: "Novo artigo" }),
  });

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
  const headers = new Headers(init?.headers);
  expect(headers.get("X-CSRF-Token")).toBe("csrf-cookie-123");
});

it("limpa sessao em memoria e cache quando recebe 401 e o refresh falha", async () => {
  stubSessionFetch();
  await fetchCmsSession();
  writeCmsQuery("cms:test", { value: 1 });
  expect(peekStoredCmsSession()?.email).toBe("admin@falcaolimpeza.com.br");

  const fetchSpy = vi.fn(async (url: string) => {
    if (String(url).endsWith("/api/cms/auth/refresh")) {
      return new Response(JSON.stringify({ detail: "Refresh expirado" }), { status: 401 });
    }
    return new Response(JSON.stringify({ detail: "Nao autenticado" }), { status: 401 });
  });
  vi.stubGlobal("fetch", fetchSpy);

  await expect(requestCmsJson("/api/cms/content")).rejects.toThrow();
  expect(peekStoredCmsSession()).toBeNull();
  expect(peekCmsQuery("cms:test")).toBeUndefined();
});
