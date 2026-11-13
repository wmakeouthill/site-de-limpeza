import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Sparkles, Tag, X } from "lucide-react";
import { useEntryPromotion, type UseEntryPromotionOptions } from "../hooks/useEntryPromotion";
import styles from "./EntryPromotionPopup.module.css";

export function EntryPromotionPopup(options: Readonly<UseEntryPromotionOptions>) {
  const { promocao, isOpen, closePopup, handleClickCta } = useEntryPromotion(options);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
      // Foco inicial no botão de fechar ou no primeiro elemento interativo
      closeButtonRef.current?.focus();
    } else {
      if (dialog.open) {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute("open");
        }
      }
      // Devolve o foco para onde estava (CA-16)
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === "function") {
        prevFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  // Tecla Escape fecha e devolve foco
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closePopup();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePopup]);

  if (!promocao) return null;

  function handleCopyCoupon() {
    if (!promocao?.codigo_cupom) return;
    try {
      navigator.clipboard?.writeText(promocao.codigo_cupom);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
    handleClickCta();
  }

  function handleCtaClick(e: React.MouseEvent) {
    handleClickCta();
    if (promocao?.tipo_acao === "cupom") {
      e.preventDefault();
      handleCopyCoupon();
    } else if (promocao?.tipo_acao === "aviso") {
      e.preventDefault();
    }
  }

  const defaultCtaLabel =
    promocao.cta_texto ||
    (promocao.tipo_acao === "cupom"
      ? "Copiar cupom"
      : promocao.tipo_acao === "link"
        ? "Ver detalhes"
        : promocao.tipo_acao === "produto"
          ? "Ver produto"
          : "Entendi");

  const href =
    promocao.tipo_acao === "link" && promocao.cta_caminho
      ? promocao.cta_caminho
      : promocao.tipo_acao === "produto" && promocao.produto_id
        ? `/produtos/${encodeURIComponent(promocao.produto_id)}`
        : "#";

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="promo-popup-title"
      aria-describedby={promocao.texto ? "promo-popup-desc" : undefined}
      data-testid="entry-promotion-dialog"
      onCancel={(e) => {
        e.preventDefault();
        closePopup();
      }}
    >
      <div className={styles.card}>
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={closePopup}
          aria-label="Fechar aviso de promoção"
          data-testid="close-popup-btn"
        >
          <X size={20} />
        </button>

        {promocao.publico !== "todos" && (
          <div className={styles.badgeContainer}>
            <Sparkles size={12} />
            <span>{promocao.publico === "casa" ? "Para sua Casa" : "Para Empresas"}</span>
          </div>
        )}

        {promocao.imagem_url && (
          <div className={styles.imageContainer}>
            <img
              src={promocao.imagem_url}
              alt={promocao.titulo}
              className={styles.image}
              loading="lazy"
            />
          </div>
        )}

        <div className={styles.content}>
          <h2 id="promo-popup-title" className={styles.title}>
            {promocao.titulo}
          </h2>

          {promocao.texto && (
            <p id="promo-popup-desc" className={styles.description}>
              {promocao.texto}
            </p>
          )}

          {promocao.tipo_acao === "cupom" && promocao.codigo_cupom && (
            <div className={styles.couponBox}>
              <div className={styles.couponLeft}>
                <Tag size={16} className={styles.couponIcon} />
                <span className={styles.couponCode}>{promocao.codigo_cupom}</span>
              </div>
              <button
                type="button"
                className={styles.couponCopyBtn}
                onClick={handleCopyCoupon}
                data-testid="copy-coupon-btn"
              >
                {copied ? (
                  <>
                    <Check size={14} /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Copiar
                  </>
                )}
              </button>
            </div>
          )}

          <div className={styles.actions}>
            {promocao.tipo_acao === "cupom" || promocao.tipo_acao === "aviso" ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleCtaClick}
                data-testid="promo-cta-btn"
              >
                {defaultCtaLabel}
              </button>
            ) : (
              <a
                href={href}
                className={styles.primaryBtn}
                onClick={handleCtaClick}
                data-testid="promo-cta-link"
              >
                <span>{defaultCtaLabel}</span>
                <ExternalLink size={14} />
              </a>
            )}

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={closePopup}
              data-testid="dismiss-popup-btn"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
