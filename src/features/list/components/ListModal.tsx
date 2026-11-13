import { useEffect, useRef, useState } from "react";
import "./ListModal.css";
import { formatBrl, formatWhatsAppListMessage } from "../utils/whatsappFormatter";
import { useListSync } from "../hooks/useListSync";
import { trackWhatsAppClick } from "../../analytics/services/trackEvent";

export interface ListModalProps {
  isOpen: boolean;
  onClose: () => void;
  lojaNome?: string;
  whatsappNumero?: string;
}

export function ListModal({
  isOpen,
  onClose,
  lojaNome = "Falcão Limpeza",
  whatsappNumero = "5521999999999",
}: ListModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const {
    items,
    totalItemsCount,
    totalEstimatedPrice,
    setItemQuantity,
    removeItem,
    clearList,
  } = useListSync();

  const [modalidade, setModalidade] = useState<"retirada" | "entrega">("retirada");
  const [bairro, setBairro] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [isEmpresa, setIsEmpresa] = useState(false);

  // Sincroniza abertura do <dialog> nativo com acessibilidade
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Lê modo empresa do atributo html / localStorage se disponível
  useEffect(() => {
    if (typeof document !== "undefined") {
      const mode = document.documentElement.getAttribute("data-theme-mode") ||
        document.body.getAttribute("data-mode");
      if (mode === "empresa") {
        setIsEmpresa(true);
      }
    }
  }, [isOpen]);

  function handleSendWhatsApp() {
    const message = formatWhatsAppListMessage({
      lojaNome,
      whatsappNumero,
      itens: items,
      modalidade,
      bairro: modalidade === "entrega" ? bairro : undefined,
      nomeCliente,
      isEmpresa,
    });

    // Dispara evento de analytics (RF-L06 / CA-23)
    trackWhatsAppClick("lista");

    const cleanNumber = whatsappNumero.replace(/\D/g, "");
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  function handleClear() {
    if (window.confirm("Deseja realmente limpar toda a lista?")) {
      clearList();
    }
  }

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="list-dialog"
      aria-labelledby="list-modal-title"
      onClose={onClose}
    >
      <div className="list-modal-content">
        {/* Cabeçalho */}
        <div className="list-modal-header">
          <div>
            <h2 id="list-modal-title" className="list-modal-title">
              Minha Lista
            </h2>
            <span className="list-modal-subtitle">
              {totalItemsCount} {totalItemsCount === 1 ? "item" : "itens"} · Preços da loja
            </span>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Fechar lista"
          >
            ×
          </button>
        </div>

        {/* Corpo da Lista */}
        <div className="list-modal-body">
          {items.length === 0 ? (
            <div className="list-empty-state">
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="#888888"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
              </svg>
              <h3>Sua lista está vazia</h3>
              <p>Adicione produtos pelo catálogo para ver o total e enviar tudo separado no WhatsApp.</p>
              <button type="button" className="btn-go-catalog" onClick={onClose}>
                Ver produtos
              </button>
            </div>
          ) : (
            <ul className="list-items-scroll">
              {items.map((it) => {
                const subtotal = it.precoAtual * it.quantidade;
                return (
                  <li key={it.id} className="list-item-row">
                    <div className="item-info">
                      <strong className="item-name">{it.nome}</strong>
                      <span className="item-meta">
                        {it.tamanho ? `${it.tamanho} · ` : ""}
                        {formatBrl(it.precoAtual)} cada
                      </span>
                    </div>

                    <div className="item-controls">
                      <div className="item-stepper">
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => setItemQuantity(it.id, it.quantidade - 1)}
                          aria-label={`Diminuir ${it.nome}`}
                        >
                          −
                        </button>
                        <span className="step-qty">{it.quantidade}</span>
                        <button
                          type="button"
                          className="step-btn"
                          onClick={() => setItemQuantity(it.id, it.quantidade + 1)}
                          aria-label={`Aumentar ${it.nome}`}
                        >
                          +
                        </button>
                      </div>

                      <span className="item-subtotal">{formatBrl(subtotal)}</span>

                      <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => removeItem(it.id)}
                        aria-label={`Remover ${it.nome} da lista`}
                        title="Remover produto"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Opções de Entrega e Identificação (se houver itens) */}
          {items.length > 0 && (
            <div className="list-options-section">
              <div className="option-group">
                <label className="option-legend">Como deseja receber?</label>
                <div className="seg-control" role="radiogroup">
                  <button
                    type="button"
                    className="seg-btn"
                    data-active={modalidade === "retirada"}
                    onClick={() => setModalidade("retirada")}
                  >
                    Vou retirar no Anil
                  </button>
                  <button
                    type="button"
                    className="seg-btn"
                    data-active={modalidade === "entrega"}
                    onClick={() => setModalidade("entrega")}
                  >
                    Entrega na região
                  </button>
                </div>
              </div>

              {modalidade === "entrega" && (
                <div className="field-block">
                  <label htmlFor="list-bairro" className="field-label">
                    Bairro para entrega *
                  </label>
                  <input
                    id="list-bairro"
                    type="text"
                    className="field-input"
                    placeholder="Ex.: Rio das Pedras, Anil, Freguesia..."
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                  />
                  <small className="field-hint">
                    A confirmação da entrega e taxas (se houver) é feita diretamente pelo WhatsApp.
                  </small>
                </div>
              )}

              <div className="field-block">
                <label htmlFor="list-nome" className="field-label">
                  Seu nome <small>(opcional)</small>
                </label>
                <input
                  id="list-nome"
                  type="text"
                  className="field-input"
                  placeholder="Como podemos te chamar?"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Totais e Ações */}
        {items.length > 0 && (
          <div className="list-modal-footer">
            <div className="list-total-row">
              <span className="total-label">Total estimado (com preço da loja):</span>
              <strong className="total-value">{formatBrl(totalEstimatedPrice)}</strong>
            </div>

            <div className="list-actions-row">
              <button
                type="button"
                className="btn-send-whatsapp"
                onClick={handleSendWhatsApp}
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
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Mandar pelo WhatsApp
              </button>

              <button type="button" className="btn-clear-list" onClick={handleClear}>
                Limpar lista
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
