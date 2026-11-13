import {
  DEFAULT_SITE_SETTINGS,
  getPublicSiteSettings,
  PublicContentUnavailableError,
  type PublicSiteSettings,
} from "./publicContent";

export { getPublicSiteSettings, type PublicSiteSettings };

const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8000";
const CATALOG_TIMEOUT_MS = 2_000;

function getInternalApiBaseUrl(): string {
  // API_INTERNAL_URL é o nome que o compose define (o mesmo do apiProxy e do publicContent).
  const envUrl =
    process.env.API_INTERNAL_URL ||
    import.meta.env.INTERNAL_API_URL ||
    import.meta.env.PUBLIC_API_URL ||
    process.env.INTERNAL_API_URL ||
    process.env.PUBLIC_API_URL;
  return (envUrl || DEFAULT_INTERNAL_API_URL).replace(/\/$/, "");
}

export interface PublicDepartamento {
  id: string;
  nome: string;
  slug: string;
  icone: string;
  descricao?: string | null;
  ordem: number;
  total_produtos?: number;
}

export interface PublicProduto {
  id: string;
  departamento_id: string;
  departamento_nome?: string | null;
  departamento_slug?: string | null;
  nome: string;
  slug: string;
  marca: string;
  tamanho: string;
  descricao: string;
  como_usar: string;
  forma: string;
  cor: string;
  imagem_url: string | null;
  imagem_posicao?: string;
  imagem_zoom?: number;
  preco_de: string;
  preco_por: string | null;
  promo_inicio?: string | null;
  promo_fim?: string | null;
  promo_ativa: boolean;
  desconto_pct: number | null;
  preco_atual: string;
  embalagem_grande: boolean;
  ordem?: number;
}

export interface PublicKitItem {
  id: string;
  produto_id: string;
  quantidade: number;
  ordem: number;
  produto?: PublicProduto | null;
}

export interface PublicKit {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  publico: string;
  ordem: number;
  itens: PublicKitItem[];
}

export interface FetchCatalogOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function fetchCatalogEndpoint<T>(
  endpointPath: string,
  options?: FetchCatalogOptions
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const baseUrl = getInternalApiBaseUrl();
  const url = `${baseUrl}${endpointPath}`;

  const timeoutMs = options?.timeoutMs ?? CATALOG_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return { ok: false, status: 404, data: null };
    }

    if (!res.ok) {
      throw new PublicContentUnavailableError(
        `Upstream retornou status ${res.status} para ${endpointPath}`
      );
    }

    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err instanceof PublicContentUnavailableError) {
      throw err;
    }
    throw new PublicContentUnavailableError(
      `Falha na comunicação com o catálogo (${endpointPath}): ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export async function getPublicDepartamentos(
  options?: FetchCatalogOptions
): Promise<PublicDepartamento[]> {
  const res = await fetchCatalogEndpoint<PublicDepartamento[]>("/api/public/departamentos", options);
  return res.data ?? [];
}

export interface ListPublicProdutosOptions extends FetchCatalogOptions {
  departamento_slug?: string;
  q?: string;
  oferta?: boolean;
  embalagem_grande?: boolean;
  marca?: string;
  ordem?: string;
}

export async function getPublicProdutos(
  options?: ListPublicProdutosOptions
): Promise<PublicProduto[]> {
  const params = new URLSearchParams();
  if (options?.departamento_slug) params.set("departamento_slug", options.departamento_slug);
  if (options?.q) params.set("q", options.q);
  if (options?.oferta) params.set("oferta", "true");
  if (options?.embalagem_grande) params.set("embalagem_grande", "true");
  if (options?.marca) params.set("marca", options.marca);
  if (options?.ordem) params.set("ordem", options.ordem);

  const qs = params.toString();
  const endpoint = qs ? `/api/public/produtos?${qs}` : "/api/public/produtos";
  const res = await fetchCatalogEndpoint<PublicProduto[]>(endpoint, options);
  return res.data ?? [];
}

export async function getPublicProdutoBySlug(
  slug: string,
  options?: FetchCatalogOptions
): Promise<PublicProduto | null> {
  const res = await fetchCatalogEndpoint<PublicProduto>(
    `/api/public/produtos/${encodeURIComponent(slug)}`,
    options
  );
  return res.data;
}

export async function getPublicKits(
  publico?: string,
  options?: FetchCatalogOptions
): Promise<PublicKit[]> {
  const endpoint = publico
    ? `/api/public/kits?publico=${encodeURIComponent(publico)}`
    : "/api/public/kits";
  const res = await fetchCatalogEndpoint<PublicKit[]>(endpoint, options);
  return res.data ?? [];
}

export interface HomeCatalogData {
  departamentos: PublicDepartamento[];
  ofertas: PublicProduto[];
  ofertasValidade: string | null;
  kits: PublicKit[];
  settings: PublicSiteSettings;
}

export async function getHomeCatalogData(
  options?: FetchCatalogOptions
): Promise<HomeCatalogData> {
  try {
    const [deptsResult, ofertasResult, kitsResult, settingsResult] = await Promise.allSettled([
      getPublicDepartamentos(options),
      getPublicProdutos({ oferta: true, ...options }),
      getPublicKits(undefined, options),
      getPublicSiteSettings(options),
    ]);

    const departamentos = deptsResult.status === "fulfilled" ? deptsResult.value : [];
    const ofertas = ofertasResult.status === "fulfilled" ? ofertasResult.value : [];
    const kits = kitsResult.status === "fulfilled" ? kitsResult.value : [];
    const settings = settingsResult.status === "fulfilled" ? settingsResult.value : DEFAULT_SITE_SETTINGS;

    let ofertasValidade: string | null = null;
    const datasValidade = ofertas
      .map((p) => p.promo_fim)
      .filter((d): d is string => Boolean(d))
      .sort();

    if (datasValidade.length > 0) {
      try {
        const d = new Date(datasValidade[0]);
        ofertasValidade = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      } catch {
        ofertasValidade = datasValidade[0];
      }
    }

    return {
      departamentos,
      ofertas,
      ofertasValidade,
      kits,
      settings,
    };
  } catch {
    return {
      departamentos: [],
      ofertas: [],
      ofertasValidade: null,
      kits: [],
      settings: DEFAULT_SITE_SETTINGS,
    };
  }
}
