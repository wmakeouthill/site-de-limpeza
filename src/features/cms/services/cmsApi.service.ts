import { publicApiBaseUrl } from "@/shared/services/api";
import { getCmsCsrfHeaders, invalidateCmsClientSession, refreshCmsSession } from "./cmsAuth.service";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function requestCmsJson<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await requestCms(path, init);
  return response.json() as Promise<TResponse>;
}

export async function requestCmsVoid(path: string, init?: RequestInit): Promise<void> {
  await requestCms(path, init);
}

export async function requestCmsBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await requestCms(path, init);
  return response.blob();
}

async function requestCms(path: string, init?: RequestInit): Promise<Response> {
  let response = await doFetch(path, init);

  if (response.status === 401) {
    const refreshed = await refreshCmsSession();
    if (refreshed) {
      response = await doFetch(path, init);
    }
    if (response.status === 401) {
      invalidateCmsClientSession();
    }
  }

  if (!response.ok) {
    const errorDetail = await getErrorDetail(response);
    if (import.meta.env.DEV) {
      console.error("CMS request failed", {
        status: response.status,
        detail: errorDetail,
        path,
      });
    }
    throw new Error(errorDetail || `CMS request failed with status ${response.status}`);
  }

  return response;
}

function doFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const csrfHeaders = MUTATING_METHODS.has(method) ? getCmsCsrfHeaders() : {};

  return fetch(`${publicApiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...csrfHeaders,
      ...init?.headers,
    },
  });
}

interface ValidationErrorItem {
  loc?: (string | number)[];
  msg?: string;
}

async function getErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { detail?: string | ValidationErrorItem[] };
    if (Array.isArray(body.detail)) {
      return formatValidationErrors(body.detail);
    }
    return body.detail ?? "";
  } catch {
    return "";
  }
}

// 422 do FastAPI: detail é uma lista; sem isso a mensagem vira "[object Object]".
function formatValidationErrors(errors: ValidationErrorItem[]): string {
  const fields = errors.map((error) => {
    const field = (error.loc ?? []).filter((part) => part !== "body").join(".");
    return error.msg ? `${field} (${error.msg})` : field;
  });
  return `Dados inválidos: ${fields.join("; ")}.`;
}
