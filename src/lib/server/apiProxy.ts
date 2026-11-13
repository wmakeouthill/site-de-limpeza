const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8000";

const EDITORIAL_READ_TIMEOUT_MS = 2_000;
const DEFAULT_PROXY_TIMEOUT_MS = 20_000;
const MEDIA_PROXY_TIMEOUT_MS = 10_000;

const UPLOAD_MAX_BODY_BYTES = 6 * 1024 * 1024; // 6 MiB
const PUBLIC_MAX_BODY_BYTES = 64 * 1024; // 64 KiB
const CMS_MAX_BODY_BYTES = 512 * 1024; // 512 KiB

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RouteRule {
  pattern: RegExp;
  methods: ReadonlySet<HttpMethod>;
  timeoutMs: number;
  maxBodyBytes?: number;
}

const SEGMENT = "[a-zA-Z0-9._-]+";

const API_ALLOWLIST: readonly RouteRule[] = [
  {
    pattern: /^\/api\/cms\/health$/,
    methods: new Set(["GET"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/cms\/auth\/me$/,
    methods: new Set(["GET"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/cms\/auth\/(login|refresh|logout)$/,
    methods: new Set(["POST"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/cms\/auth\/photo$/,
    methods: new Set(["PUT"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/cms\/content$/,
    methods: new Set(["GET"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
  },
  {
    pattern: new RegExp(`^/api/cms/authors(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(
      `^/api/cms/articles(?:/${SEGMENT}(?:/(publish|unpublish|archive|unarchive))?)?$`,
    ),
    methods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(
      `^/api/cms/cases(?:/${SEGMENT}(?:/(publish|unpublish|archive|unarchive))?)?$`,
    ),
    methods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(
      `^/api/cms/guides(?:/${SEGMENT}(?:/(publish|unpublish|archive|unarchive))?)?$`,
    ),
    methods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/testimonials(?:/reorder|/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/cms\/uploads$/,
    methods: new Set(["POST"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: UPLOAD_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/contacts(?:/export|/${SEGMENT}(?:/journey)?)?$`),
    methods: new Set(["GET", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/cms\/analytics(?:\/pages)?$/,
    methods: new Set(["GET"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/cms\/site-settings$/,
    methods: new Set(["GET", "PUT", "PATCH"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/campaign-links(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/departamentos(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/produtos(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/kits(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/cms/promocoes(?:/${SEGMENT})?$`),
    methods: new Set(["GET", "POST", "PUT", "DELETE"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: CMS_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/public\/promocoes\/ativas$/,
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/departamentos$/,
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: new RegExp(`^/api/public/produtos(?:/${SEGMENT})?$`),
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/kits$/,
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: new RegExp(`^/api/public/articles(?:/${SEGMENT}(?:/likes(?:/toggle)?)?)?$`),
    methods: new Set(["GET", "POST"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
    maxBodyBytes: PUBLIC_MAX_BODY_BYTES,
  },
  {
    pattern: new RegExp(`^/api/public/cases(?:/${SEGMENT})?$`),
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: new RegExp(`^/api/public/guides(?:/${SEGMENT})?$`),
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/site-settings$/,
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/testimonials$/,
    methods: new Set(["GET"]),
    timeoutMs: EDITORIAL_READ_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/contact$/,
    methods: new Set(["POST"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: PUBLIC_MAX_BODY_BYTES,
  },
  {
    pattern: /^\/api\/public\/track\.js$/,
    methods: new Set(["GET"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
  },
  {
    pattern: /^\/api\/public\/(events|tracking\/forget)$/,
    methods: new Set(["POST"]),
    timeoutMs: DEFAULT_PROXY_TIMEOUT_MS,
    maxBodyBytes: PUBLIC_MAX_BODY_BYTES,
  },
];

const REQUEST_STRIP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-real-ip",
]);

const RESPONSE_STRIP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
  "set-cookie",
]);

const RASTER_MEDIA_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

function getInternalApiBaseUrl(): string {
  const configured =
    (typeof process !== "undefined" ? process.env.API_INTERNAL_URL : undefined) ||
    import.meta.env?.API_INTERNAL_URL ||
    DEFAULT_INTERNAL_API_URL;
  const parsed = new URL(configured);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid API_INTERNAL_URL protocol");
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

function hasPathTraversal(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (
    lower.includes("..") ||
    lower.includes("\\") ||
    lower.includes("%2e") ||
    lower.includes("%2f") ||
    lower.includes("%5c") ||
    lower.includes("\0")
  ) {
    return true;
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

function normalizeApiPath(rawPath: string): string | null {
  if (hasPathTraversal(rawPath)) {
    return null;
  }
  const clean = rawPath.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) {
    return null;
  }
  const withPrefix = clean.startsWith("api/") ? `/${clean}` : `/api/${clean}`;
  if (withPrefix.includes("//")) {
    return null;
  }
  return withPrefix;
}

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function proxyApi(request: Request, path: string): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (hasPathTraversal(requestUrl.pathname)) {
    return jsonError(404, "Rota não encontrada.");
  }

  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath) {
    return jsonError(404, "Rota não encontrada.");
  }

  const matchedRule = API_ALLOWLIST.find((rule) => rule.pattern.test(normalizedPath));
  if (!matchedRule) {
    return jsonError(404, "Rota não encontrada.");
  }

  const method = request.method.toUpperCase() as HttpMethod;
  if (!matchedRule.methods.has(method)) {
    return jsonError(405, "Método não permitido.");
  }

  // Enforce strict method-specific constraints on shared patterns
  if (
    normalizedPath.startsWith("/api/public/articles") &&
    method === "POST" &&
    !normalizedPath.endsWith("/likes/toggle")
  ) {
    return jsonError(405, "Método não permitido.");
  }

  let bodyBuffer: ArrayBuffer | undefined;
  if (method !== "GET" && (method as string) !== "HEAD") {
    const maxBytes = matchedRule.maxBodyBytes ?? CMS_MAX_BODY_BYTES;
    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        return jsonError(413, "Payload excede o limite permitido.");
      }
    }

    bodyBuffer = await request.arrayBuffer();
    if (bodyBuffer.byteLength > maxBytes) {
      return jsonError(413, "Payload excede o limite permitido.");
    }
  }

  const baseUrl = getInternalApiBaseUrl();
  const upstreamUrl = `${baseUrl}${normalizedPath}${requestUrl.search}`;

  const upstreamHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!REQUEST_STRIP_HEADERS.has(lowerKey)) {
      upstreamHeaders.set(key, value);
    }
  });

  const timeoutMs =
    normalizedPath.startsWith("/api/public/articles") && method === "POST"
      ? DEFAULT_PROXY_TIMEOUT_MS
      : matchedRule.timeoutMs;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers: upstreamHeaders,
      body: bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return jsonError(
      503,
      isAbort ? "Tempo limite excedido ao consultar a API." : "Serviço temporariamente indisponível.",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  const responseHeaders = new Headers();
  upstreamResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!RESPONSE_STRIP_HEADERS.has(lowerKey)) {
      responseHeaders.set(key, value);
    }
  });

  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) {
      responseHeaders.append("Set-Cookie", cookie);
    }
  } else {
    const rawSetCookie = upstreamResponse.headers.get("set-cookie");
    if (rawSetCookie) {
      responseHeaders.append("Set-Cookie", rawSetCookie);
    }
  }

  if (normalizedPath.startsWith("/api/cms/")) {
    responseHeaders.set("Cache-Control", "no-store");
  }

  const status = upstreamResponse.status;
  const isBodylessStatus =
    status === 204 ||
    status === 205 ||
    status === 301 ||
    status === 302 ||
    status === 303 ||
    status === 304 ||
    status === 307 ||
    status === 308;

  const responseBody = isBodylessStatus ? null : await upstreamResponse.arrayBuffer();

  return new Response(responseBody, {
    status,
    headers: responseHeaders,
  });
}

export async function proxyMedia(request: Request, rawPath: string): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return jsonError(405, "Método não permitido.");
  }

  const requestUrl = new URL(request.url);
  if (hasPathTraversal(rawPath) || hasPathTraversal(requestUrl.pathname)) {
    return jsonError(400, "Caminho de mídia inválido.");
  }

  const trimmed = rawPath.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.startsWith(".")) {
    return jsonError(400, "Nome de arquivo inválido.");
  }

  const lower = trimmed.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".svgz")) {
    return jsonError(415, "Formato SVG não permitido.");
  }

  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex <= 0) {
    return jsonError(404, "Mídia não encontrada.");
  }

  const ext = lower.slice(dotIndex);
  const safeContentType = RASTER_MEDIA_TYPES[ext];
  if (!safeContentType) {
    return jsonError(415, "Formato de mídia não suportado.");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return jsonError(400, "Nome de arquivo inválido.");
  }

  const baseUrl = getInternalApiBaseUrl();
  const upstreamUrl = `${baseUrl}/media/${encodeURIComponent(trimmed)}`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), MEDIA_PROXY_TIMEOUT_MS);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
  } catch {
    return jsonError(502, "Mídia temporariamente indisponível.");
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!upstreamResponse.ok) {
    return jsonError(upstreamResponse.status === 404 ? 404 : 502, "Mídia não encontrada.");
  }

  const data = await upstreamResponse.arrayBuffer();
  const headers = new Headers({
    "Content-Type": safeContentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control":
      upstreamResponse.headers.get("cache-control") || "public, max-age=31536000, immutable",
  });

  return new Response(method === "HEAD" ? null : data, {
    status: 200,
    headers,
  });
}
