import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  trackWhatsAppClick,
  trackListaAdd,
  trackBusca,
  trackPopupEvent,
  trackEvent,
  ALLOWED_WHATSAPP_TARGETS,
  type WhatsAppClickTarget,
} from "./trackEvent";

describe("trackEvent service (CA-23 / LGPD)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete window.talimpoTrack;
    delete window.auTrack;
  });

  afterEach(() => {
    delete window.talimpoTrack;
    delete window.auTrack;
  });

  it("chama window.talimpoTrack quando disponível", () => {
    const mockTrack = vi.fn();
    window.talimpoTrack = mockTrack;

    trackEvent("pageview", "/produtos");
    expect(mockTrack).toHaveBeenCalledWith("pageview", "/produtos");
  });

  it("dispara CustomEvent no fallback se window.talimpoTrack não estiver definido", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    trackEvent("click", "banner-promocao");
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("talimpo:analytics-event");
    expect(event.detail).toEqual({ event: "click", target: "banner-promocao" });
  });

  describe("trackWhatsAppClick (CA-23)", () => {
    it("permite todos os targets canônicos", () => {
      const mockTrack = vi.fn();
      window.talimpoTrack = mockTrack;

      const targets: WhatsAppClickTarget[] = ["lista", "cotacao", "bairro", "produto", "flutuante"];

      for (const target of targets) {
        const result = trackWhatsAppClick(target);
        expect(result).toBe(true);
        expect(mockTrack).toHaveBeenCalledWith("whatsapp_click", target);
      }
      expect(mockTrack).toHaveBeenCalledTimes(targets.length);
    });

    it("rejeita e não dispara eventos com targets livres, mensagens ou telefones (LGPD)", () => {
      const mockTrack = vi.fn();
      window.talimpoTrack = mockTrack;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // @ts-expect-error teste com valor inválido
      const resultMsg = trackWhatsAppClick("Olá gostaria de comprar água sanitária");
      expect(resultMsg).toBe(false);

      // @ts-expect-error teste com valor inválido
      const resultPhone = trackWhatsAppClick("21999998888");
      expect(resultPhone).toBe(false);

      // @ts-expect-error teste com valor inválido
      const resultCart = trackWhatsAppClick("carrinho");
      expect(resultCart).toBe(false);

      expect(mockTrack).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("trackListaAdd", () => {
    it("envia evento lista_add com id sanitizado", () => {
      const mockTrack = vi.fn();
      window.talimpoTrack = mockTrack;

      trackListaAdd(" prod-123 ");
      expect(mockTrack).toHaveBeenCalledWith("lista_add", "prod-123");
    });
  });

  describe("trackBusca", () => {
    it("envia termo sanitizado e limitado a 50 chars", () => {
      const mockTrack = vi.fn();
      window.talimpoTrack = mockTrack;

      const longo = "a".repeat(100);
      trackBusca(longo);
      expect(mockTrack).toHaveBeenCalledWith("busca", "a".repeat(50));
    });
  });

  describe("trackPopupEvent", () => {
    it("envia popup_view, popup_click e popup_close com id", () => {
      const mockTrack = vi.fn();
      window.talimpoTrack = mockTrack;

      trackPopupEvent("view", "promo-01");
      expect(mockTrack).toHaveBeenCalledWith("popup_view", "promo-01");

      trackPopupEvent("click", "promo-01");
      expect(mockTrack).toHaveBeenCalledWith("popup_click", "promo-01");

      trackPopupEvent("close", "promo-01");
      expect(mockTrack).toHaveBeenCalledWith("popup_close", "promo-01");
    });
  });
});
