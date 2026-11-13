const DEFAULT_API_URL = "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const publicApiBaseUrl =
  typeof window !== "undefined"
    ? ""
    : (import.meta.env.PUBLIC_API_URL?.replace(/\/$/, "") ??
      import.meta.env.VITE_PUBLIC_API_URL?.replace(/\/$/, "") ??
      DEFAULT_API_URL);

export async function requestJson<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${publicApiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<TResponse>;
}
