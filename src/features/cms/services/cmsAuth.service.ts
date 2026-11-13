import { publicApiBaseUrl } from "@/shared/services/api";
import { clearCmsQueryCache } from "../hooks/cmsQueryCache";

export interface CmsSession {
  email: string;
  name: string;
  photoUrl?: string | null;
}

interface RawCmsSessionResponse {
  email?: string;
  name?: string;
  photoUrl?: string | null;
  photo_url?: string | null;
  csrfToken?: string | null;
  csrf_token?: string | null;
}

const AUTH_BASE = `${publicApiBaseUrl}/api/cms/auth`;
const CSRF_COOKIE_NAME = "talimpo_cms_csrf";

let storedSession: CmsSession | null | undefined;
let storedCsrfToken: string | null = null;

function readCsrfCookie(): string | null {
  if (typeof document === "undefined" || !document.cookie) {
    return null;
  }

  const prefix = `${CSRF_COOKIE_NAME}=`;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!entry) {
    return null;
  }

  const rawValue = entry.slice(prefix.length);
  return rawValue ? decodeURIComponent(rawValue) : null;
}

export function getCmsCsrfToken(): string | null {
  return readCsrfCookie() ?? storedCsrfToken;
}

export function setCmsCsrfToken(token: string | null | undefined): void {
  storedCsrfToken = token?.trim() ? token.trim() : null;
}

export function getCmsCsrfHeaders(): Record<string, string> {
  const token = getCmsCsrfToken();
  return token ? { "X-CSRF-Token": token } : {};
}

function parseSessionPayload(payload: unknown): CmsSession | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as RawCmsSessionResponse;
  const csrfFromBody = raw.csrfToken ?? raw.csrf_token;
  if (typeof csrfFromBody === "string" && csrfFromBody.trim()) {
    setCmsCsrfToken(csrfFromBody);
  }

  if (typeof raw.email !== "string" || typeof raw.name !== "string") {
    return null;
  }

  const session: CmsSession = {
    email: raw.email,
    name: raw.name,
  };

  if (raw.photoUrl !== undefined || raw.photo_url !== undefined) {
    session.photoUrl = raw.photoUrl ?? raw.photo_url ?? null;
  }

  return session;
}

export function peekStoredCmsSession(): CmsSession | null | undefined {
  return storedSession;
}

export function clearStoredCmsSession(): void {
  storedSession = undefined;
  storedCsrfToken = null;
}

export function invalidateCmsClientSession(): void {
  storedSession = null;
  storedCsrfToken = null;
  clearCmsQueryCache();
}

const LOGIN_ERROR_MESSAGES: Record<number, string> = {
  401: "E-mail ou senha inválidos.",
  403: "Este e-mail não tem acesso ao CMS.",
  422: "Preencha e-mail e senha.",
  429: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
};

/** Retorna `null` no sucesso (cookies de sessão já gravados) ou a mensagem de erro. */
export async function loginCms(email: string, password: string): Promise<string | null> {
  const response = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.ok) {
    clearStoredCmsSession();
    return null;
  }
  return LOGIN_ERROR_MESSAGES[response.status] ?? "Não foi possível entrar agora. Tente de novo.";
}

export async function fetchCmsSession(): Promise<CmsSession | null> {
  const response = await fetch(`${AUTH_BASE}/me`, { credentials: "include" });
  let session: CmsSession | null = null;

  if (response.status === 401) {
    const refreshed = await refreshCmsSession();
    if (refreshed) {
      const retry = await fetch(`${AUTH_BASE}/me`, { credentials: "include" });
      session = retry.ok ? parseSessionPayload(await retry.json()) : null;
    }
  } else if (response.ok) {
    session = parseSessionPayload(await response.json());
  }

  storedSession = session;
  return session;
}

export async function updateCmsProfilePhoto(photoUrl: string): Promise<CmsSession> {
  let response = await putProfilePhoto(photoUrl);

  if (response.status === 401) {
    const refreshed = await refreshCmsSession();
    if (refreshed) {
      response = await putProfilePhoto(photoUrl);
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      invalidateCmsClientSession();
    }
    throw new Error("Nao foi possivel atualizar a foto.");
  }

  const session = parseSessionPayload(await response.json());
  if (!session) {
    throw new Error("Resposta de sessao invalida.");
  }
  storedSession = session;
  return session;
}

export async function refreshCmsSession(): Promise<boolean> {
  const response = await fetch(`${AUTH_BASE}/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...getCmsCsrfHeaders(),
    },
  });

  if (!response.ok) {
    invalidateCmsClientSession();
    return false;
  }

  try {
    const payload = (await response.clone().json()) as RawCmsSessionResponse;
    const csrfFromBody = payload?.csrfToken ?? payload?.csrf_token;
    if (typeof csrfFromBody === "string" && csrfFromBody.trim()) {
      setCmsCsrfToken(csrfFromBody);
    }
  } catch {
    // Empty or non-JSON refresh response is valid when cookie is set via Set-Cookie
  }

  return true;
}

function putProfilePhoto(photoUrl: string): Promise<Response> {
  return fetch(`${AUTH_BASE}/photo`, {
    method: "PUT",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...getCmsCsrfHeaders(),
    },
    body: JSON.stringify({ photo_url: photoUrl }),
  });
}

export async function logoutCms(): Promise<void> {
  const csrfHeaders = getCmsCsrfHeaders();
  storedSession = undefined;
  storedCsrfToken = null;
  clearCmsQueryCache();
  await fetch(`${AUTH_BASE}/logout`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders,
  });
}
