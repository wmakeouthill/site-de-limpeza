import { useEffect, useState } from "react";
import { readStoredList } from "../hooks/useListSync";
import { ListModal } from "./ListModal";

export interface ListContainerProps {
  lojaNome?: string;
  whatsappNumero?: string;
}

export function ListContainer({
  lojaNome = "Falcão Limpeza",
  whatsappNumero = "5521999999999",
}: ListContainerProps) {
  const [isOpen, setIsOpen] = useState(false);

  function syncBadges() {
    const list = readStoredList();
    const count = Object.values(list).reduce((acc, q) => acc + q, 0);

    const headerCount = document.getElementById("header-list-count");
    if (headerCount) {
      headerCount.textContent = String(count);
      headerCount.setAttribute("data-count", String(count));
    }

    const mobileCount = document.getElementById("mobile-list-count");
    if (mobileCount) {
      mobileCount.textContent = String(count);
      mobileCount.setAttribute("data-count", String(count));
    }
  }

  useEffect(() => {
    syncBadges();

    // Abre se URL indicar lista
    if (typeof window !== "undefined") {
      if (
        window.location.hash === "#lista" ||
        window.location.search.includes("lista=1")
      ) {
        setIsOpen(true);
      }
    }

    function handleOpenEvent() {
      setIsOpen(true);
    }

    function handleSyncEvent() {
      syncBadges();
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const trigger = target.closest<HTMLElement>(
        'a[href="/lista"], .lista-btn, [data-open-list]'
      );
      if (trigger) {
        e.preventDefault();
        setIsOpen(true);
      }
    }

    window.addEventListener("storage", handleSyncEvent);
    window.addEventListener("talimpo:list-sync", handleSyncEvent);
    window.addEventListener("talimpo:list-updated", handleSyncEvent);
    window.addEventListener("talimpo:open-list", handleOpenEvent);
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("storage", handleSyncEvent);
      window.removeEventListener("talimpo:list-sync", handleSyncEvent);
      window.removeEventListener("talimpo:list-updated", handleSyncEvent);
      window.removeEventListener("talimpo:open-list", handleOpenEvent);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <ListModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      lojaNome={lojaNome}
      whatsappNumero={whatsappNumero}
    />
  );
}
