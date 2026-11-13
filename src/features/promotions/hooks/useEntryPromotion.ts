import { useEffect, useState } from "react";
import type { PublicPromocaoRead } from "../types/promotions.types";
import { trackPopupEvent } from "@/features/analytics/services/trackEvent";

export interface UseEntryPromotionOptions {
  delayMs?: number;
  initialPromocoes?: PublicPromocaoRead[];
  bypassCmsCheck?: boolean;
}

export interface UseEntryPromotionResult {
  promocao: PublicPromocaoRead | null;
  isOpen: boolean;
  closePopup: () => void;
  handleClickCta: () => void;
}

const STORAGE_VISTAS_KEYS = ["falcao-promo-vista", "talimpo-promo-vista"];
const STORAGE_MODO_KEYS = ["falcao-modo", "talimpo-modo"];
const SESSION_EXIBIDA_KEY = "falcao-promo-exibida";

export function getStoredVistas(): Record<string, string> {
  if (typeof window === "undefined") return {};
  for (const key of STORAGE_VISTAS_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore JSON parse error
    }
  }
  return {};
}

export function saveStoredVista(id: string) {
  if (typeof window === "undefined") return;
  const hoje = new Date().toISOString().slice(0, 10);
  const vistas = getStoredVistas();
  vistas[id] = hoje;
  const serialized = JSON.stringify(vistas);
  for (const key of STORAGE_VISTAS_KEYS) {
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // ignore storage full/blocked
    }
  }
}

export function getCurrentModo(): "casa" | "empresa" {
  if (typeof window === "undefined") return "casa";
  for (const key of STORAGE_MODO_KEYS) {
    const val = localStorage.getItem(key);
    if (val === "empresa" || val === "casa") return val;
  }
  return "casa";
}

export function filterAndSelectPromotion(
  promocoes: PublicPromocaoRead[],
  modo: "casa" | "empresa",
  vistas: Record<string, string>,
  hojeStr: string = new Date().toISOString().slice(0, 10)
): PublicPromocaoRead | null {
  const elegiveis = promocoes.filter((p) => {
    // 1. Filtro de público (CA-15)
    if (p.publico !== "todos" && p.publico !== modo) {
      return false;
    }

    // 2. Filtro de frequência (CA-14)
    const ultimaVista = vistas[p.id];
    if (ultimaVista) {
      if (p.frequencia === "uma_vez") {
        return false;
      }
      if (p.frequencia === "diaria") {
        // Se já viu hoje, não reabre
        if (ultimaVista.slice(0, 10) === hojeStr) {
          return false;
        }
      }
    }

    return true;
  });

  if (elegiveis.length === 0) return null;

  // 3. Desempate por prioridade DESC, data_inicio DESC, id ASC (CA-13)
  elegiveis.sort((a, b) => {
    if (b.prioridade !== a.prioridade) {
      return b.prioridade - a.prioridade;
    }
    const tA = new Date(a.data_inicio).getTime() || 0;
    const tB = new Date(b.data_inicio).getTime() || 0;
    if (tB !== tA) {
      return tB - tA;
    }
    return a.id.localeCompare(b.id);
  });

  return elegiveis[0];
}



export function useEntryPromotion({
  delayMs = 2000,
  initialPromocoes,
  bypassCmsCheck = false,
}: UseEntryPromotionOptions = {}): UseEntryPromotionResult {
  const [promocao, setPromocao] = useState<PublicPromocaoRead | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Bloqueio no CMS (CA-16)
    if (!bypassCmsCheck && window.location.pathname.startsWith("/cms")) {
      return;
    }

    // Bloqueio por sessão: no máximo uma exibição por sessão (CA-13, RF-E02)
    try {
      if (sessionStorage.getItem(SESSION_EXIBIDA_KEY)) {
        return;
      }
    } catch {
      // sessionStorage indisponível
    }

    let isMounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function init() {
      try {
        let lista: PublicPromocaoRead[] = [];
        if (initialPromocoes) {
          lista = initialPromocoes;
        } else {
          const res = await fetch("/api/public/promocoes/ativas");
          if (!res.ok) return;
          lista = await res.json();
        }

        if (!isMounted || !Array.isArray(lista) || lista.length === 0) return;

        const modo = getCurrentModo();
        const vistas = getStoredVistas();
        const selected = filterAndSelectPromotion(lista, modo, vistas);

        if (!selected || !isMounted) return;

        setPromocao(selected);

        // Agendamento da exibição com o delay especificado (RF-E04)
        timer = setTimeout(() => {
          if (!isMounted) return;
          // Não abrir se a lista modal estiver aberta
          const listDialog = document.querySelector('[data-testid="list-modal"][open], #list-dialog[open]');
          if (listDialog) return;

          setIsOpen(true);
          try {
            sessionStorage.setItem(SESSION_EXIBIDA_KEY, selected.id);
          } catch {
            // ignore
          }
          trackPopupEvent("view", selected.id);
        }, delayMs);
      } catch {
        // falha silenciosa para não travar o site
      }
    }

    init();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [delayMs, initialPromocoes, bypassCmsCheck]);

  function closePopup() {
    if (promocao) {
      saveStoredVista(promocao.id);
      trackPopupEvent("close", promocao.id);
    }
    setIsOpen(false);
  }

  function handleClickCta() {
    if (promocao) {
      saveStoredVista(promocao.id);
      trackPopupEvent("click", promocao.id);
    }
    setIsOpen(false);
  }

  return {
    promocao,
    isOpen,
    closePopup,
    handleClickCta,
  };
}
