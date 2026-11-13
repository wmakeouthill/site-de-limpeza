import { useState } from "react";
import { Check, Copy, ExternalLink, Sparkles, Tag, X } from "lucide-react";
import type { PromocaoPublico, PromocaoTipoAcao } from "../../types/cms.types";
import styles from "./CmsPromotionsPage.module.css";

interface CmsPromotionPreviewProps {
  titulo: string;
  texto?: string | null;
  imagem_url?: string | null;
  tipo_acao: PromocaoTipoAcao;
  cta_texto?: string | null;
  cta_caminho?: string | null;
  codigo_cupom?: string | null;
  publico: PromocaoPublico;
  device?: "desktop" | "mobile";
}

export function CmsPromotionPreview({
  titulo,
  texto,
  imagem_url,
  tipo_acao,
  cta_texto,
  codigo_cupom,
  publico,
  device = "desktop",
}: Readonly<CmsPromotionPreviewProps>) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!codigo_cupom) return;
    try {
      navigator.clipboard?.writeText(codigo_cupom);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  const defaultCta =
    cta_texto ||
    (tipo_acao === "cupom"
      ? "Copiar cupom"
      : tipo_acao === "link"
        ? "Ver detalhes"
        : tipo_acao === "produto"
          ? "Ver produto"
          : "Entendi");

  const publicoLabel =
    publico === "casa"
      ? "Exclusivo para Casa"
      : publico === "empresa"
        ? "Exclusivo para Empresas"
        : null;

  return (
    <div
      className={`${styles.previewWrapper} ${
        device === "mobile" ? styles.previewMobile : styles.previewDesktop
      }`}
      data-testid="promotion-preview"
    >
      <div className={styles.previewBackdrop}>
        <div className={styles.popupCard} role="dialog" aria-modal="true">
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Fechar prévia"
          >
            <X size={18} />
          </button>

          {publicoLabel && (
            <div className={styles.publicoBadge}>
              <Sparkles size={12} />
              <span>{publicoLabel}</span>
            </div>
          )}

          {imagem_url && (
            <div className={styles.popupImageContainer}>
              <img
                src={imagem_url}
                alt={titulo || "Imagem da promoção"}
                className={styles.popupImage}
              />
            </div>
          )}

          <div className={styles.popupContent}>
            <h3 className={styles.popupTitle}>{titulo || "Título da Promoção"}</h3>
            {texto && <p className={styles.popupText}>{texto}</p>}

            {tipo_acao === "cupom" && (
              <div className={styles.couponBox}>
                <div className={styles.couponLeft}>
                  <Tag size={16} className={styles.couponIcon} />
                  <span className={styles.couponCode}>
                    {codigo_cupom || "CODIGO"}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.couponCopyBtn}
                  onClick={handleCopy}
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

            <div className={styles.popupActions}>
              <button type="button" className={styles.popupPrimaryBtn}>
                <span>{defaultCta}</span>
                {tipo_acao === "link" && <ExternalLink size={14} />}
              </button>
              <button type="button" className={styles.popupSecondaryBtn}>
                Agora não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
