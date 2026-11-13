import { useEffect, useState } from "react";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { trackListaAdd } from "@/features/analytics/services/trackEvent";
import { formatBrl } from "@/features/list/utils/whatsappFormatter";

export interface ProductQuantitySelectorProps {
  produto: PublicProduto;
}

export function ProductQuantitySelector({ produto }: ProductQuantitySelectorProps) {
  const [quantidade, setQuantidade] = useState(1);
  const [inListQty, setInListQty] = useState(0);

  const unitPrice = parseFloat(produto.preco_atual.replace(",", ".")) || 0;
  const subtotal = formatBrl(unitPrice * quantidade);

  // Lê quantidade já na lista do localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("talimpo-lista");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[produto.id]) {
          setInListQty(parsed[produto.id]);
          setQuantidade(parsed[produto.id]);
        }
      }
    } catch {
      // Ignora erro de JSON
    }
  }, [produto.id]);

  function handleDecrement() {
    setQuantidade((prev) => (prev > 1 ? prev - 1 : 1));
  }

  function handleIncrement() {
    setQuantidade((prev) => (prev < 999 ? prev + 1 : 999));
  }

  function handleAddToList() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("talimpo-lista");
      const list = raw ? JSON.parse(raw) : {};
      list[produto.id] = quantidade;
      localStorage.setItem("talimpo-lista", JSON.stringify(list));
      setInListQty(quantidade);

      // Dispara evento de telemetria (CA-23)
      trackListaAdd(produto.id);

      // Dispara evento nativo
      window.dispatchEvent(
        new CustomEvent("talimpo:list-updated", {
          detail: { list, produtoId: produto.id, quantidade },
        })
      );
    } catch {
      // Falha silenciosa no storage
    }
  }

  return (
    <div className="pd-buy-box">
      <div className="pd-stepper-row">
        <div className="pd-stepper">
          <button
            type="button"
            className="pd-step-btn"
            onClick={handleDecrement}
            aria-label="Diminuir quantidade"
            disabled={quantidade <= 1}
          >
            −
          </button>
          <span className="pd-step-qty" aria-live="polite">
            {quantidade}
          </span>
          <button
            type="button"
            className="pd-step-btn"
            onClick={handleIncrement}
            aria-label="Aumentar quantidade"
            disabled={quantidade >= 999}
          >
            +
          </button>
        </div>

        <button type="button" className="pd-btn-add" onClick={handleAddToList}>
          {inListQty === 0
            ? "Pôr na lista"
            : inListQty === quantidade
            ? "Já está na lista"
            : "Atualizar lista"}
        </button>
      </div>

      <p className="pd-subtotal">
        {quantidade} × {formatBrl(produto.preco_atual)} = <strong>{subtotal}</strong>
      </p>
    </div>
  );
}
