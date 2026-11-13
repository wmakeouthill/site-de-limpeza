export type CmsContentType = "article" | "case" | "guide";
export type CmsContentStatus = "draft" | "published" | "archived";
export type CmsSiteScope = "falcao" | "talimpo";
export type ContactSiteScope = "falcao" | "talimpo";

export type ContactStatus = "pending" | "sent" | "failed";

export interface ContactMessageItem {
  id: string;
  name: string;
  company?: string;
  email?: string;
  /** Celular/WhatsApp informado no formulario, quando preenchido. */
  phone: string;
  role?: string;
  interest?: string;
  area?: string;
  urgent?: boolean;
  message: string;
  page: string;
  source: string;
  site: ContactSiteScope;
  status: ContactStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ContactStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  last7Days: number;
}

export interface ContactMessageList {
  items: ContactMessageItem[];
  total: number;
  page: number;
  pageSize: number;
  stats: ContactStats;
}

export interface ContactFilters {
  status?: ContactStatus;
  site?: ContactSiteScope;
  search?: string;
  area?: string;
  urgent?: boolean;
  days?: 7 | 30 | 90;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export type TrackingStatus = "available" | "unavailable";

export interface JourneyContact {
  id: string;
  name: string;
  email: string;
  site: ContactSiteScope;
  formPage: string;
  submittedAt: string;
}

export interface LeadAttribution {
  entryPage: string;
  referrerHost: string;
  referrerUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  campaignLink?: CampaignSourceLink | null;
  device: string;
}

export interface CampaignSourceLink {
  identifier: string;
  title: string;
  sourceUrl: string;
  thumbnailUrl: string;
  redirectUrl: string;
}

export interface LeadJourneyEvent {
  type: string;
  page: string;
  target: string;
  occurredAt: string;
  dwellMs: number;
}

export interface ContactJourney {
  contact: JourneyContact;
  trackingStatus: TrackingStatus;
  attribution: LeadAttribution | null;
  events: LeadJourneyEvent[];
  timelineTruncated: boolean;
}

export interface AnalyticsOverview {
  visitors: number;
  pageviews: number;
  clicks: number;
  formSubmits: number;
  /** Mediana, nao media: uma aba esquecida aberta distorce a media. */
  medianDwellMs: number;
  bounceRate: number;
}

export interface AnalyticsPoint {
  day: string;
  visitors: number;
  pageviews: number;
  bySite?: AnalyticsPointSite[];
}

export interface AnalyticsSiteCount {
  site: ContactSiteScope;
  count: number;
}

export interface AnalyticsPointSite {
  site: ContactSiteScope;
  visitors: number;
  pageviews: number;
}

export interface AnalyticsCreative {
  label: string;
  count: number;
  placement: string;
  link?: CampaignSourceLink | null;
}

export interface AnalyticsCampaign {
  label: string;
  count: number;
  creatives: AnalyticsCreative[];
}

export interface AnalyticsPeriod {
  start: string;
  end: string;
}

export interface AnalyticsWeeklyRhythmPoint {
  weekday: number;
  label: string;
  visitors: number;
}

export interface AnalyticsChannel {
  site: ContactSiteScope;
  overview: AnalyticsOverview;
}

export interface AnalyticsFunnelStep {
  step: string;
  label: string;
  sessions: number;
  /** % sobre o primeiro passo do funil. */
  rate: number;
  bySite?: AnalyticsSiteCount[];
}

export interface AnalyticsRow {
  label: string;
  count: number;
  /** Valores originais que formaram este rótulo normalizado. */
  rawLabels?: Array<{ label: string; count: number }>;
  /** So nas origens: campanhas, criativos e links observados. */
  campaigns?: AnalyticsCampaign[];
  /** So nos CTAs: media de onde o clique cai dentro do botao, em %. */
  posX: number | null;
  posY: number | null;
  bySite?: AnalyticsSiteCount[];
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  period: AnalyticsPeriod;
  comparisonOverview: AnalyticsOverview;
  timeseries: AnalyticsPoint[];
  comparisonTimeseries: AnalyticsPoint[];
  weeklyRhythm: AnalyticsWeeklyRhythmPoint[];
  pagesPerSession: number;
  channels: AnalyticsChannel[];
  funnel: AnalyticsFunnelStep[];
  topPages: AnalyticsRow[];
  topCtas: AnalyticsRow[];
  sources: AnalyticsRow[];
  devices: AnalyticsRow[];
  whatsappClicks?: AnalyticsRow[];
  topListaProducts?: AnalyticsRow[];
  topSearchTerms?: AnalyticsRow[];
  promotionsSummary?: AnalyticsRow[];
}

export interface AnalyticsPageItem {
  site: ContactSiteScope;
  path: string;
  pageviews: number;
}

export interface AnalyticsPageList {
  items: AnalyticsPageItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImagePosition {
  x: number;
  y: number;
  zoom: number;
}

export interface CmsContentSummary {
  id: string;
  site: CmsSiteScope;
  contentType: CmsContentType;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  updatedAt: string | null;
  publishedAt: string | null;
  detailLabel: string;
}

export interface CmsContentList {
  items: CmsContentSummary[];
  total: number;
}

export interface CmsContentFilters {
  contentType: CmsContentType;
  status?: CmsContentStatus;
  site?: CmsSiteScope;
}

export interface CmsAuthor {
  email: string;
  name: string;
  photoUrl: string;
}

export interface CmsArticle {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  area: string;
  categoria?: string;
  readingTime: string;
  thumbnailAssetId: string | null;
  thumbnailUrl: string;
  thumbnailPosition: ImagePosition;
  authorName: string;
  authorEmail: string | null;
  authorImageUrl: string;
}

export interface CmsArticlePayload {
  site: CmsSiteScope;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  area: string;
  categoria?: string;
  readingTime: string;
  thumbnailAssetId: string | null;
  thumbnailUrl: string;
  thumbnailPosition: ImagePosition;
  authorName: string;
  authorEmail: string | null;
  authorImageUrl: string;
}

export interface CmsCaseMetric {
  prefix: string;
  value: string;
  label: string;
}

export interface CmsCaseTag {
  label: string;
}

export interface CmsCase {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  /** Tema / Área Penal do guia de defesa (campo obrigatório) */
  topic: string;
  clientName?: string;
  clientLogoAssetId?: string | null;
  clientLogoUrl?: string;
  companyIconAssetId?: string | null;
  companyIconUrl?: string;
  screenshotAssetId: string | null;
  screenshotUrl: string;
  screenshotPosition: ImagePosition;
  metrics?: CmsCaseMetric[];
  tags: CmsCaseTag[];
}

export interface CmsCasePayload {
  site: CmsSiteScope;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  /** Tema / Área Penal do guia de defesa (campo obrigatório) */
  topic: string;
  clientName?: string;
  clientLogoAssetId?: string | null;
  clientLogoUrl?: string;
  companyIconAssetId?: string | null;
  companyIconUrl?: string;
  screenshotAssetId: string | null;
  screenshotUrl: string;
  screenshotPosition: ImagePosition;
  metrics?: CmsCaseMetric[];
  tags: CmsCaseTag[];
}

export interface CmsTestimonial {
  id: string;
  site: CmsSiteScope;
  author: string;
  role: string;
  company: string;
  quote: string;
  youtubeId: string;
  avatarUrl: string;
  sortOrder: number;
  isActive: boolean;
}


export interface CmsDepartamento {
  id: string;
  nome: string;
  slug: string;
  descricao?: string | null;
  icone: string;
  uso?: string | null;
  cuidado?: string | null;
  ordem: number;
  is_active: boolean;
  total_produtos?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CmsDepartamentoPayload {
  nome: string;
  slug?: string | null;
  descricao?: string | null;
  icone?: string;
  uso?: string | null;
  cuidado?: string | null;
  ordem?: number;
  is_active?: boolean;
}

export interface CmsProduto {
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
  imagem_posicao: string;
  imagem_zoom: number;
  preco_de: string;
  preco_por: string | null;
  promo_inicio: string | null;
  promo_fim: string | null;
  promo_ativa: boolean;
  desconto_pct: number | null;
  preco_atual: string;
  embalagem_grande: boolean;
  ordem: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CmsProdutoPayload {
  departamento_id: string;
  nome: string;
  slug?: string | null;
  marca?: string;
  tamanho?: string;
  descricao?: string;
  como_usar?: string;
  forma?: string;
  cor?: string;
  imagem_url?: string | null;
  imagem_posicao?: string;
  imagem_zoom?: number;
  preco_de: string | number;
  preco_por?: string | number | null;
  promo_inicio?: string | null;
  promo_fim?: string | null;
  embalagem_grande?: boolean;
  ordem?: number;
  is_active?: boolean;
}

export interface CmsKitItem {
  id: string;
  produto_id: string;
  produto?: CmsProduto | null;
  quantidade: number;
  ordem: number;
}

export interface CmsKit {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  publico: string;
  ordem: number;
  itens: CmsKitItem[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CmsKitPayload {
  nome: string;
  slug?: string | null;
  descricao?: string;
  publico?: string;
  ordem?: number;
  is_active?: boolean;
  itens?: Array<{ produto_id: string; quantidade: number; ordem?: number }>;
}

// =============================================================================
// PROMOÇÕES DE ENTRADA
// =============================================================================

export type PromocaoTipoAcao = "link" | "cupom" | "aviso" | "produto";
export type PromocaoPublico = "todos" | "casa" | "empresa";
export type PromocaoFrequencia = "uma_vez" | "diaria" | "sempre";
export type PromocaoSituacao = "no_ar" | "agendada" | "encerrada" | "desligada";

export interface CmsPromocao {
  id: string;
  titulo: string;
  texto?: string | null;
  imagem_url?: string | null;
  tipo_acao: PromocaoTipoAcao;
  produto_id?: string | null;
  cta_texto?: string | null;
  cta_caminho?: string | null;
  codigo_cupom?: string | null;
  whatsapp_mensagem?: string | null;
  publico: PromocaoPublico;
  frequencia: PromocaoFrequencia;
  data_inicio: string;
  data_fim: string;
  prioridade: number;
  is_active: boolean;
  situacao: PromocaoSituacao;
  views_count: number;
  clicks_count: number;
  taxa_clique_pct: number;
  created_at: string;
  updated_at: string;
}

export interface CmsPromocaoPayload {
  titulo: string;
  texto?: string | null;
  imagem_url?: string | null;
  tipo_acao: PromocaoTipoAcao;
  produto_id?: string | null;
  cta_texto?: string | null;
  cta_caminho?: string | null;
  codigo_cupom?: string | null;
  whatsapp_mensagem?: string | null;
  publico: PromocaoPublico;
  frequencia: PromocaoFrequencia;
  data_inicio: string;
  data_fim: string;
  prioridade: number;
  is_active: boolean;
}



export type CmsPublicoGuia = "todos" | "casa" | "empresa";

export interface CmsGuideProduto {
  id?: string;
  produto_id: string;
  nome?: string;
  slug?: string;
  quantidade: number;
  ordem: number;
  preco_atual?: string;
  preco_de?: string;
  preco_por?: string | null;
  is_active?: boolean;
  imagem_url?: string | null;
  forma?: string | null;
  cor?: string | null;
  tamanho?: string | null;
}

export interface CmsGuide {
  id: string;
  site: CmsSiteScope;
  status: CmsContentStatus;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  coverAssetId: string | null;
  publico: CmsPublicoGuia;
  tempoMinutos: number;
  etiqueta: string;
  icone: string;
  dificuldade: string;
  produtos: CmsGuideProduto[];
  authorName: string;
  authorEmail: string | null;
  authorImageUrl: string;
}

export interface CmsGuidePayload {
  site: CmsSiteScope;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  seoTitle: string;
  seoDescription: string;
  coverAssetId: string | null;
  publico: CmsPublicoGuia;
  tempoMinutos: number;
  etiqueta: string;
  icone: string;
  dificuldade: string;
  produtos: { produto_id: string; quantidade: number; ordem: number }[];
  authorName: string;
  authorEmail: string | null;
  authorImageUrl: string;
}
