/**
 * Serviço de telemetria e eventos de analytics para o site da Falcão Limpeza.
 * Em conformidade estrita com LGPD e CA-23:
 * - Nenhum dado de mensagem, nome, telefone, lista de compras ou CNPJ é transmitido ou gravado.
 * - whatsapp_click aceita apenas os targets canônicos: 'lista', 'cotacao', 'bairro', 'produto', 'flutuante'.
 */

export type WhatsAppClickTarget = "lista" | "cotacao" | "bairro" | "produto" | "flutuante";
export type PopupEventAction = "view" | "click" | "close";

export const ALLOWED_WHATSAPP_TARGETS: ReadonlySet<string> = new Set([
  "lista",
  "cotacao",
  "bairro",
  "produto",
  "flutuante",
]);

declare global {
  interface Window {
    talimpoTrack?: (event: string, extra?: Record<string, unknown> | string) => void;
    auTrack?: (event: string, extra?: Record<string, unknown> | string) => void;
  }
}

/**
 * Dispara evento genérico no tracker oficial ou fallback para CustomEvent no DOM.
 */
export function trackEvent(event: string, target?: string): void {
  if (typeof window === "undefined") return;

  const sanitizedTarget = target !== undefined ? String(target).trim() : "";

  if (typeof window.talimpoTrack === "function") {
    window.talimpoTrack(event, sanitizedTarget);
    return;
  }

  if (typeof window.auTrack === "function") {
    window.auTrack(event, sanitizedTarget);
    return;
  }

  window.dispatchEvent(
    new CustomEvent("talimpo:analytics-event", {
      detail: { event, target: sanitizedTarget },
    })
  );
}

/**
 * Registra clique para o WhatsApp (CA-23).
 * Aceita EXCLUSIVAMENTE os alvos permitidos para evitar qualquer vazamento de PII.
 */
export function trackWhatsAppClick(target: WhatsAppClickTarget): boolean {
  if (!ALLOWED_WHATSAPP_TARGETS.has(target)) {
    console.warn(`[analytics] Target de WhatsApp inválido ignorado: ${target}`);
    return false;
  }
  trackEvent("whatsapp_click", target);
  return true;
}

/**
 * Registra adição de item à Lista de Produtos.
 */
export function trackListaAdd(produtoId: string): void {
  const sanitized = String(produtoId || "").trim().slice(0, 80);
  if (sanitized) {
    trackEvent("lista_add", sanitized);
  }
}

/**
 * Registra busca de produto no catálogo.
 */
export function trackBusca(termo: string): void {
  const sanitized = String(termo || "").trim().slice(0, 50);
  if (sanitized) {
    trackEvent("busca", sanitized);
  }
}

/**
 * Registra eventos de ciclo de vida de popups de promoção (view, click, close).
 */
export function trackPopupEvent(action: PopupEventAction, promocaoId: string): void {
  const sanitized = String(promocaoId || "").trim().slice(0, 80);
  trackEvent(`popup_${action}`, sanitized);
}
