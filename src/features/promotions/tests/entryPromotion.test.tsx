// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  filterAndSelectPromotion,
  getStoredVistas,
} from "../hooks/useEntryPromotion";
import { EntryPromotionPopup } from "../components/EntryPromotionPopup";
import type { PublicPromocaoRead } from "../types/promotions.types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Entry Promotion (CA-13, CA-14, CA-15, CA-16)", () => {
  const promoPrioridade1: PublicPromocaoRead = {
    id: "promo-p1",
    titulo: "Promoção Prioridade Baixa",
    texto: "Texto P1",
    tipo_acao: "aviso",
    publico: "todos",
    frequencia: "uma_vez",
    prioridade: 1,
    data_inicio: "2026-10-01T00:00:00Z",
    data_fim: "2026-10-31T23:59:59Z",
  };

  const promoPrioridade5: PublicPromocaoRead = {
    id: "promo-p5",
    titulo: "Promoção Prioridade Alta",
    texto: "Texto P5",
    tipo_acao: "cupom",
    codigo_cupom: "ALTA5",
    publico: "todos",
    frequencia: "uma_vez",
    prioridade: 5,
    data_inicio: "2026-10-05T00:00:00Z",
    data_fim: "2026-10-31T23:59:59Z",
  };

  const promoEmpresa: PublicPromocaoRead = {
    id: "promo-emp",
    titulo: "Promoção Exclusiva para Empresas",
    texto: "Condições atacado",
    tipo_acao: "link",
    cta_caminho: "/empresas",
    publico: "empresa",
    frequencia: "uma_vez",
    prioridade: 10,
    data_inicio: "2026-10-01T00:00:00Z",
    data_fim: "2026-10-31T23:59:59Z",
  };

  const promoDiaria: PublicPromocaoRead = {
    id: "promo-diaria",
    titulo: "Promoção Diária",
    texto: "Aviso do dia",
    tipo_acao: "aviso",
    publico: "todos",
    frequencia: "diaria",
    prioridade: 2,
    data_inicio: "2026-10-01T00:00:00Z",
    data_fim: "2026-10-31T23:59:59Z",
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    (window as any).talimpoTrack = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function renderPopup(props: Parameters<typeof EntryPromotionPopup>[0] = {}) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(<EntryPromotionPopup {...props} />);
    });
    return container;
  }

  it("CA-13: entre duas promoções no ar para 'todos', seleciona a de maior prioridade (5 vs 1)", () => {
    const promocoes = [promoPrioridade1, promoPrioridade5];
    const vistas: Record<string, string> = {};

    const selected = filterAndSelectPromotion(promocoes, "casa", vistas);
    expect(selected).not.toBeNull();
    expect(selected?.id).toBe("promo-p5");
    expect(selected?.prioridade).toBe(5);
  });

  it("CA-14: promoção com frequência 'uma_vez' não reaparece após ser vista", () => {
    const promocoes = [promoPrioridade5];
    const vistas: Record<string, string> = { "promo-p5": "2026-10-20" };

    const selected = filterAndSelectPromotion(promocoes, "casa", vistas);
    expect(selected).toBeNull();
  });

  it("CA-14: promoção com frequência 'diaria' reaparece no dia seguinte, mas não no mesmo dia", () => {
    const promocoes = [promoDiaria];

    // Se vista ontem (2026-10-22) e hoje é 2026-10-23
    const vistasOntem: Record<string, string> = { "promo-diaria": "2026-10-22" };
    const selectedOntem = filterAndSelectPromotion(promocoes, "casa", vistasOntem, "2026-10-23");
    expect(selectedOntem).not.toBeNull();
    expect(selectedOntem?.id).toBe("promo-diaria");

    // Se já vista hoje (2026-10-23)
    const vistasHoje: Record<string, string> = { "promo-diaria": "2026-10-23" };
    const selectedHoje = filterAndSelectPromotion(promocoes, "casa", vistasHoje, "2026-10-23");
    expect(selectedHoje).toBeNull();
  });

  it("CA-15: promoção com público 'empresa' não aparece quando visitante está no modo 'casa'", () => {
    const promocoes = [promoEmpresa];
    const vistas: Record<string, string> = {};

    // No modo casa
    const selectedCasa = filterAndSelectPromotion(promocoes, "casa", vistas);
    expect(selectedCasa).toBeNull();

    // No modo empresa
    const selectedEmpresa = filterAndSelectPromotion(promocoes, "empresa", vistas);
    expect(selectedEmpresa).not.toBeNull();
    expect(selectedEmpresa?.id).toBe("promo-emp");
  });

  it("CA-16: nunca exibe popup em rotas que iniciam com /cms", async () => {
    // Simula estar na rota /cms/produtos
    window.history.pushState({}, "", "/cms/produtos");

    const container = await renderPopup({
      delayMs: 0,
      initialPromocoes: [promoPrioridade5],
    });

    const dialog = container.querySelector('[data-testid="entry-promotion-dialog"]');
    expect(dialog).toBeNull();

    // Restaura rota
    window.history.pushState({}, "", "/");
  });

  it("CA-16: abre dialog acessível, botão 'Agora não' fecha e grava vista no localStorage", async () => {
    const container = await renderPopup({
      delayMs: 0,
      initialPromocoes: [promoPrioridade5],
      bypassCmsCheck: true,
    });

    const dialog = container.querySelector<HTMLDialogElement>('[data-testid="entry-promotion-dialog"]');
    expect(dialog).not.toBeNull();
    expect(container.textContent).toContain("Promoção Prioridade Alta");
    expect(container.textContent).toContain("ALTA5");

    const dismissBtn = container.querySelector<HTMLButtonElement>('[data-testid="dismiss-popup-btn"]');
    expect(dismissBtn).not.toBeNull();

    await act(async () => {
      dismissBtn!.click();
    });

    // Verificamos que foi gravado como visto em falcao-promo-vista
    const vistas = getStoredVistas();
    expect(vistas["promo-p5"]).toBeDefined();
  });

  it("CA-16: fechar com a tecla Escape fecha o popup e devolve o foco", async () => {
    // Cria um botão anterior na página e dá foco nele
    const triggerBtn = document.createElement("button");
    triggerBtn.textContent = "Botão da página";
    document.body.appendChild(triggerBtn);
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    await renderPopup({
      delayMs: 0,
      initialPromocoes: [promoPrioridade5],
      bypassCmsCheck: true,
    });

    // Pressiona Escape na janela
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    // Foco volta para o botão anterior
    expect(document.activeElement).toBe(triggerBtn);
    document.body.removeChild(triggerBtn);
  });
});
