const DEFAULT_INTERNAL_API_URL = "http://127.0.0.1:8000";
const EDITORIAL_TIMEOUT_MS = 2_000;

export class PublicContentUnavailableError extends Error {
  constructor(message = "Serviço de conteúdo público indisponível", public readonly cause?: unknown) {
    super(message);
    this.name = "PublicContentUnavailableError";
  }
}

export interface HorarioFuncionamentoPublic {
  dias_semana: number[];
  abre: string;
  fecha: string;
}

export interface PublicSiteSettings {
  loja_nome: string;
  razao_social?: string | null;
  cnpj?: string | null;
  whatsapp_numero: string;
  telefone_exibicao?: string | null;
  endereco: string;
  bairro_cidade: string;
  referencia_endereco?: string | null;
  maps_url?: string | null;
  horarios: HorarioFuncionamentoPublic[];
  horario_obs?: string | null;
  pagamento: string;
  chave_pix?: string | null;
  bairros_entrega: string[];
  prazo_separacao?: string | null;
  instagram_url?: string | null;
  articles_enabled: boolean;
  guides_enabled: boolean;
  testimonials_enabled: boolean;
}

export interface PublicArticleSummary {
  id: string;
  area: string;
  categoria?: string;
  reading_time: string;
  title: string;
  thumbnail: string;
  thumbnail_alt?: string;
  thumbnail_position_x?: number;
  thumbnail_position_y?: number;
  thumbnail_zoom?: number;
  href: string;
  slug: string;
  first_published_at: string | null;
}

export interface PublicArticleDetailResponse extends PublicArticleSummary {
  excerpt: string;
  body_markdown: string;
  seo_title: string;
  seo_description: string;
  author: string;
  author_image_url?: string | null;
  published_at: string | null;
  updated_at: string | null;
}

export interface PublicGuideProduto {
  id: string;
  produto_id: string;
  nome: string;
  slug: string;
  quantidade: number;
  ordem: number;
  preco_atual: string;
  preco_de: string;
  preco_por?: string | null;
  is_active: boolean;
  imagem_url?: string | null;
  forma?: string | null;
  cor?: string | null;
  tamanho?: string | null;
}

export interface PublicGuideSummary {
  id: string;
  title: string;
  slug: string;
  publico: string;
  tempo_minutos: number;
  tempo_display: string;
  etiqueta: string;
  icone: string;
  dificuldade: string;
  excerpt: string;
  cover_url?: string | null;
  first_published_at: string | null;
}

export interface PublicGuideDetailResponse extends PublicGuideSummary {
  body_markdown: string;
  seo_title: string;
  seo_description: string;
  author: string;
  published_at: string | null;
  updated_at: string | null;
  produtos: PublicGuideProduto[];
}

export interface HomeEditorialData {
  settings: PublicSiteSettings;
  featuredArticle: PublicArticleSummary | null;
  recentArticles: PublicArticleSummary[];
  recentGuides: PublicGuideSummary[];
}

export interface FetchOptions {
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function getInternalApiBaseUrl(): string {
  const configured =
    (typeof process !== "undefined" ? process.env.API_INTERNAL_URL : undefined) ||
    (typeof import.meta !== "undefined" ? import.meta.env?.API_INTERNAL_URL : undefined) ||
    DEFAULT_INTERNAL_API_URL;

  try {
    const parsed = new URL(configured);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return DEFAULT_INTERNAL_API_URL;
  }
}

async function executePublicFetch<T>(
  endpointPath: string,
  options?: FetchOptions
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const baseUrl = getInternalApiBaseUrl();
  const url = `${baseUrl}${endpointPath}`;

  const timeoutMs = options?.timeoutMs ?? EDITORIAL_TIMEOUT_MS;
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
        `Upstream returned status ${res.status} for ${endpointPath}`
      );
    }

    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    if (err instanceof PublicContentUnavailableError) {
      throw err;
    }
    throw new PublicContentUnavailableError(
      `Falha na comunicação editorial (${endpointPath}): ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export const DEFAULT_SITE_SETTINGS: PublicSiteSettings = {
  loja_nome: "Falcão Limpeza",
  razao_social: null,
  cnpj: null,
  whatsapp_numero: "5521999999999",
  telefone_exibicao: "(21) 99999-9999",
  endereco: "Estrada de Jacarepaguá, 5171",
  bairro_cidade: "Anil, Rio de Janeiro - RJ",
  referencia_endereco: "pertinho de Rio das Pedras",
  maps_url: null,
  horarios: [],
  horario_obs: null,
  pagamento: "Dinheiro, Pix, cartões de débito e crédito",
  chave_pix: null,
  bairros_entrega: ["Anil", "Rio das Pedras", "Gardênia Azul"],
  prazo_separacao: "Separado em ~30 min",
  instagram_url: null,
  articles_enabled: true,
  guides_enabled: true,
  testimonials_enabled: true,
};

export async function getPublicSiteSettings(options?: FetchOptions): Promise<PublicSiteSettings> {
  try {
    const result = await executePublicFetch<Partial<PublicSiteSettings>>("/api/public/site-settings", options);
    if (!result.data) {
      return DEFAULT_SITE_SETTINGS;
    }
    return {
      loja_nome: result.data.loja_nome || DEFAULT_SITE_SETTINGS.loja_nome,
      razao_social: result.data.razao_social || null,
      cnpj: result.data.cnpj || null,
      whatsapp_numero: result.data.whatsapp_numero || DEFAULT_SITE_SETTINGS.whatsapp_numero,
      telefone_exibicao: result.data.telefone_exibicao || DEFAULT_SITE_SETTINGS.telefone_exibicao,
      endereco: result.data.endereco || DEFAULT_SITE_SETTINGS.endereco,
      bairro_cidade: result.data.bairro_cidade || DEFAULT_SITE_SETTINGS.bairro_cidade,
      referencia_endereco: result.data.referencia_endereco || DEFAULT_SITE_SETTINGS.referencia_endereco,
      maps_url: result.data.maps_url || null,
      horarios: result.data.horarios || [],
      horario_obs: result.data.horario_obs || null,
      pagamento: result.data.pagamento || DEFAULT_SITE_SETTINGS.pagamento,
      chave_pix: result.data.chave_pix || null,
      bairros_entrega: result.data.bairros_entrega || DEFAULT_SITE_SETTINGS.bairros_entrega,
      prazo_separacao: result.data.prazo_separacao || DEFAULT_SITE_SETTINGS.prazo_separacao,
      instagram_url: result.data.instagram_url || null,
      articles_enabled: result.data.articles_enabled !== false,
      guides_enabled: result.data.guides_enabled !== false,
      testimonials_enabled: result.data.testimonials_enabled !== false,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function getPublicArticlesList(options?: FetchOptions): Promise<PublicArticleSummary[]> {
  const result = await executePublicFetch<PublicArticleSummary[]>("/api/public/articles", options);
  return result.data ?? [];
}

export async function getPublicArticle(
  slug: string,
  options?: FetchOptions
): Promise<PublicArticleDetailResponse | null> {
  if (!slug || typeof slug !== "string") {
    return null;
  }
  const result = await executePublicFetch<PublicArticleDetailResponse>(
    `/api/public/articles/${encodeURIComponent(slug)}`,
    options
  );
  if (result.status === 404 || !result.ok) {
    return null;
  }
  return result.data;
}

export async function getPublicGuidesList(options?: FetchOptions): Promise<PublicGuideSummary[]> {
  const result = await executePublicFetch<PublicGuideSummary[]>("/api/public/guides", options);
  return result.data ?? [];
}

export async function getPublicGuide(
  slug: string,
  options?: FetchOptions
): Promise<PublicGuideDetailResponse | null> {
  if (!slug || typeof slug !== "string") {
    return null;
  }
  const result = await executePublicFetch<PublicGuideDetailResponse>(
    `/api/public/guides/${encodeURIComponent(slug)}`,
    options
  );
  if (result.status === 404 || !result.ok) {
    return null;
  }
  return result.data;
}

export async function getHomeEditorialData(
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<HomeEditorialData | null> {
  const timeoutMs = options?.timeoutMs ?? EDITORIAL_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fetchOptions: FetchOptions = {
      fetchFn: options?.fetchFn,
      signal: controller.signal,
      timeoutMs,
    };

    const settings = await getPublicSiteSettings(fetchOptions);

    let articles: PublicArticleSummary[] = [];
    if (settings.articles_enabled) {
      articles = await getPublicArticlesList(fetchOptions);
    }

    let guides: PublicGuideSummary[] = [];
    if (settings.guides_enabled) {
      guides = await getPublicGuidesList(fetchOptions);
    }

    const featuredArticle = articles.length > 0 ? articles[0] : null;
    const recentArticles = articles.length > 1 ? articles.slice(1, 3) : [];
    const recentGuides = guides.slice(0, 3);

    return {
      settings,
      featuredArticle,
      recentArticles,
      recentGuides,
    };
  } catch (_err) {
    // Na home, falha na API editorial não pode quebrar a landing page.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}


export interface PublicTestimonial {
  id: string;
  author: string;
  role?: string | null;
  company?: string | null;
  quote: string;
  avatar_url?: string | null;
  youtube_id?: string | null;
}

export async function getPublicTestimonials(options?: FetchOptions): Promise<PublicTestimonial[]> {
  try {
    const result = await executePublicFetch<PublicTestimonial[]>("/api/public/testimonials", options);
    return result.data ?? [];
  } catch {
    return [];
  }
}
