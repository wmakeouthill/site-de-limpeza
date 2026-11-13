import { useState } from "react";
import type { PublicGuideProduto } from "@/lib/server/publicContent";
import { readStoredList, writeStoredList } from "@/features/list/hooks/useListSync";
import { trackListaAdd } from "@/features/analytics/services/trackEvent";
import { formatBrl } from "@/features/list/utils/whatsappFormatter";
import styles from "./GuideIngredientsList.module.css";

export interface GuideIngredientsListProps {
  produtos: PublicGuideProduto[];
}

export function GuideIngredientsList({ produtos }: GuideIngredientsListProps) {
  const [added, setAdded] = useState(false);

  if (!produtos || produtos.length === 0) {
    return null;
  }

  const activeProdutos = produtos.filter((p) => p.is_active && p.quantidade > 0);
  const hasActive = activeProdutos.length > 0;

  function handleAddAllToList() {
    if (!hasActive) return;

    const list = readStoredList();

    // Incrementa cada produto ativo pela quantidade indicada (CA-18)
    for (const item of activeProdutos) {
      list[item.produto_id] = (list[item.produto_id] || 0) + item.quantidade;
      trackListaAdd(item.produto_id);
    }

    writeStoredList(list);
    setAdded(true);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("talimpo:open-list"));
      if ((window as any).showToast) {
        (window as any).showToast("Insumos do guia adicionados à lista!");
      }
    }

    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <section className={styles.container} aria-labelledby="guide-ingredients-title">
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h3 id="guide-ingredients-title">O que você vai precisar</h3>
          <p>Insumos e materiais recomendados para executar este passo a passo.</p>
        </div>
        <button
          type="button"
          className={styles.addAllBtn}
          onClick={handleAddAllToList}
          disabled={!hasActive}
          aria-label="Pôr todos os insumos recomendados na lista"
          data-testid="add-all-ingredients-btn"
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
          {added ? "Insumos na lista!" : "Pôr tudo na lista"}
        </button>
      </div>

      <div className={styles.itemsGrid} data-testid="ingredients-grid">
        {produtos.map((item) => {
          const isItemActive = item.is_active !== false;
          return (
            <div
              key={item.id || item.produto_id}
              className={`${styles.itemCard} ${!isItemActive ? styles.itemCardInactive : ""}`}
              data-testid={`ingredient-item-${item.produto_id}`}
            >
              <div className={styles.itemThumb}>
                {item.imagem_url ? (
                  <img src={item.imagem_url} alt={item.nome} loading="lazy" />
                ) : (
                  <div className={styles.itemPlaceholder}>
                    <svg
                      viewBox="0 0 24 24"
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M10 2v3M14 2v3M8.5 5h7M7 8h10l1 13H6L7 8z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className={styles.itemDetails}>
                <a
                  href={`/produtos/${item.slug}`}
                  className={styles.itemName}
                  title={item.nome}
                >
                  {item.nome}
                </a>
                <div className={styles.itemMeta}>
                  <span className={styles.itemQtd}>{item.quantidade}x</span>
                  {isItemActive ? (
                    <span className={styles.itemPrice}>{formatBrl(item.preco_atual)}</span>
                  ) : (
                    <span className={styles.unavailableBadge} data-testid="unavailable-badge">
                      Temporariamente indisponível
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
