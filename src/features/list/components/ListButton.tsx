import { useEffect, useState } from "react";
import { readStoredList } from "../hooks/useListSync";
import { ListModal } from "./ListModal";

export interface ListButtonProps {
  lojaNome?: string;
  whatsappNumero?: string;
}

export function ListButton({
  lojaNome = "Falcão Limpeza",
  whatsappNumero = "5521999999999",
}: ListButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  function updateTotal() {
    const list = readStoredList();
    const count = Object.values(list).reduce((acc, q) => acc + q, 0);
    setTotalItems(count);
  }

  useEffect(() => {
    updateTotal();

    function handleStorage() {
      updateTotal();
    }

    function handleOpen() {
      setIsModalOpen(true);
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("talimpo:list-sync", handleStorage);
    window.addEventListener("talimpo:list-updated", handleStorage);
    window.addEventListener("talimpo:open-list", handleOpen);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("talimpo:list-sync", handleStorage);
      window.removeEventListener("talimpo:list-updated", handleStorage);
      window.removeEventListener("talimpo:open-list", handleOpen);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        className="btn-lista-nav"
        onClick={() => setIsModalOpen(true)}
        aria-label={`Abrir Minha Lista (${totalItems} ${totalItems === 1 ? "item" : "itens"})`}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </svg>
        <span className="btn-lista-label">Minha lista</span>
        <span className="btn-lista-badge" data-count={totalItems}>
          {totalItems}
        </span>
      </button>

      <ListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lojaNome={lojaNome}
        whatsappNumero={whatsappNumero}
      />
    </>
  );
}
