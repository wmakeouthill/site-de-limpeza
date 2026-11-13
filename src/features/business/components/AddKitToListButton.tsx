import { useState } from "react";
import type { PublicKit } from "@/lib/server/publicCatalog";
import { readStoredList, writeStoredList } from "@/features/list/hooks/useListSync";

export interface AddKitToListButtonProps {
  kit: PublicKit;
}

export function AddKitToListButton({ kit }: AddKitToListButtonProps) {
  const [added, setAdded] = useState(false);

  function handleAddKit() {
    const list = readStoredList();

    // Soma as quantidades do kit às que já estão na lista (CA-09, RF-L05)
    for (const item of kit.itens) {
      if (item.quantidade > 0) {
        list[item.produto_id] = (list[item.produto_id] || 0) + item.quantidade;
      }
    }

    writeStoredList(list);
    setAdded(true);

    // Abre a janela da lista automaticamente (RF-L05)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("talimpo:open-list"));
      if ((window as any).showToast) {
        (window as any).showToast(`Kit "${kit.nome}" adicionado à lista!`);
      }
    }

    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <button
      type="button"
      className="btn-add-kit"
      onClick={handleAddKit}
      aria-label={`Pôr o kit ${kit.nome} na lista`}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </svg>
      {added ? "Kit na lista!" : "Pôr o kit na lista"}
    </button>
  );
}
