import { useCallback, useEffect, useState } from "react";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import type { WhatsAppListItem } from "../utils/whatsappFormatter";

const PRIMARY_KEY = "talimpo-lista";
const FALLBACK_KEY = "falcao-lista";

export interface EnrichedListItem extends WhatsAppListItem {
  slug: string;
  marca?: string;
  imagemUrl?: string | null;
  cor?: string;
  forma?: string;
}

export function readStoredList(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PRIMARY_KEY) || localStorage.getItem(FALLBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

export function writeStoredList(list: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(list);
    localStorage.setItem(PRIMARY_KEY, serialized);
    localStorage.setItem(FALLBACK_KEY, serialized);
    window.dispatchEvent(new CustomEvent("talimpo:list-sync", { detail: list }));
    window.dispatchEvent(new CustomEvent("talimpo:list-updated", { detail: list }));
  } catch {
    // Falha silenciosa de quota
  }
}

export function useListSync() {
  const [storedList, setStoredList] = useState<Record<string, number>>({});
  const [activeCatalog, setActiveCatalog] = useState<PublicProduto[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Carrega dados do catálogo público ativo
  const fetchActiveCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/public/produtos");
      if (res.ok) {
        const data = (await res.json()) as PublicProduto[];
        setActiveCatalog(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Inicialização e sincronização com storage
  useEffect(() => {
    setStoredList(readStoredList());
    fetchActiveCatalog();

    function handleStorage() {
      setStoredList(readStoredList());
    }

    function handleAdd(e: Event) {
      const custom = e as CustomEvent<{ id: string; quantidade?: number }>;
      if (custom.detail?.id) {
        const id = custom.detail.id;
        const addQty = custom.detail.quantidade || 1;
        setStoredList((prev) => {
          const current = prev[id] || 0;
          const next = { ...prev, [id]: current + addQty };
          writeStoredList(next);
          return next;
        });
      }
    }

    function handleListUpdated() {
      setStoredList(readStoredList());
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("talimpo:add-to-list", handleAdd as EventListener);
    window.addEventListener("talimpo:list-sync", handleStorage);
    window.addEventListener("talimpo:list-updated", handleListUpdated);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("talimpo:add-to-list", handleAdd as EventListener);
      window.removeEventListener("talimpo:list-sync", handleStorage);
      window.removeEventListener("talimpo:list-updated", handleListUpdated);
    };
  }, [fetchActiveCatalog]);

  // 3. Validação e enriquecimento contra catálogo ativo (CA-06, CA-08)
  const activeProductsMap = new Map(activeCatalog.map((p) => [p.id, p]));

  const enrichedItems: EnrichedListItem[] = [];
  let needsPruning = false;
  const prunedList: Record<string, number> = {};

  if (activeCatalog.length > 0) {
    for (const [id, qty] of Object.entries(storedList)) {
      const prod = activeProductsMap.get(id);
      if (!prod) {
        // Produto não existe mais ou foi inativado (CA-06)
        needsPruning = true;
        continue;
      }

      prunedList[id] = qty;
      const unitPrice = parseFloat(prod.preco_atual.replace(",", ".")) || 0;

      enrichedItems.push({
        id: prod.id,
        nome: prod.nome,
        slug: prod.slug,
        marca: prod.marca,
        tamanho: prod.tamanho,
        precoAtual: unitPrice,
        quantidade: qty,
        imagemUrl: prod.imagem_url,
        cor: prod.cor,
        forma: prod.forma,
      });
    }

    // Se houve inativação de produtos, limpa o storage silenciosamente (CA-06)
    if (needsPruning) {
      writeStoredList(prunedList);
    }
  }

  // 4. Ações na lista
  const setItemQuantity = useCallback((id: string, qty: number) => {
    setStoredList((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[id];
      } else {
        next[id] = Math.min(qty, 999);
      }
      writeStoredList(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setStoredList((prev) => {
      const next = { ...prev };
      delete next[id];
      writeStoredList(next);
      return next;
    });
  }, []);

  const addKit = useCallback((kitItens: Array<{ produto_id: string; quantidade: number }>) => {
    setStoredList((prev) => {
      const next = { ...prev };
      for (const it of kitItens) {
        const current = next[it.produto_id] || 0;
        next[it.produto_id] = current + it.quantidade; // CA-09: soma quantidade
      }
      writeStoredList(next);
      return next;
    });
  }, []);

  const clearList = useCallback(() => {
    setStoredList({});
    writeStoredList({});
  }, []);

  const totalItemsCount = Object.values(storedList).reduce((acc, q) => acc + q, 0);

  const totalEstimatedPrice = enrichedItems.reduce(
    (acc, it) => acc + it.precoAtual * it.quantidade,
    0
  );

  return {
    items: enrichedItems,
    totalItemsCount,
    totalEstimatedPrice,
    setItemQuantity,
    removeItem,
    addKit,
    clearList,
    loading,
    refreshCatalog: fetchActiveCatalog,
  };
}
