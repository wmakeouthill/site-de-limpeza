import type React from "react";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { formatBrl } from "@/features/list/utils/whatsappFormatter";
import { fotoStyle } from "@/features/catalog/utils/productPhoto";

export interface ProductCardProps {
  produto: PublicProduto;
  onAddToList?: (produto: PublicProduto) => void;
}

export function ProductCard({ produto, onAddToList }: ProductCardProps) {
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // 1. Notifica callback React se houver
    if (onAddToList) {
      onAddToList(produto);
    }

    // 2. Dispara evento nativo para a ilha da lista
    const event = new CustomEvent("talimpo:add-to-list", {
      detail: {
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco_atual,
        quantidade: 1,
      },
    });
    window.dispatchEvent(event);
  }

  const precoDe = produto.preco_de;
  const precoPor = produto.preco_por;
  const isPromo = produto.promo_ativa && Boolean(precoPor);

  return (
    <article className="cat-card">
      <a className="cat-card-link" href={`/produtos/${produto.slug}`}>
        <div
          className="cat-card-thumb"
          style={{ backgroundColor: produto.cor ? `${produto.cor}15` : "var(--surface-2)" }}
        >
          {produto.imagem_url ? (
            <span className="cat-thumb-photo">
              <img
                src={produto.imagem_url}
                alt={produto.nome}
                loading="lazy"
                decoding="async"
                className="cat-thumb-img"
                style={fotoStyle(produto.imagem_posicao, produto.imagem_zoom)}
              />
            </span>
          ) : (
            <div className="cat-thumb-fallback" aria-hidden="true">
              <svg viewBox="0 0 100 140" width="80" height="112">
                <rect x="36" y="16" width="28" height="18" rx="4" fill="#333333" />
                <rect
                  x="20"
                  y="34"
                  width="60"
                  height="96"
                  rx="8"
                  fill={produto.cor || "#003399"}
                />
                <rect x="28" y="66" width="44" height="40" rx="4" fill="#ffffff" />
                <rect
                  x="34"
                  y="78"
                  width="32"
                  height="4"
                  rx="2"
                  fill={produto.cor || "#003399"}
                />
              </svg>
            </div>
          )}

          <div className="cat-badges">
            {produto.embalagem_grande && (
              <span className="badge-grande">Grande</span>
            )}
            {isPromo && produto.desconto_pct && (
              <span className="badge-promo">-{produto.desconto_pct}%</span>
            )}
          </div>
        </div>

        <div className="cat-card-body">
          <span className="cat-meta">
            {produto.marca ? `${produto.marca} · ` : ""}
            {produto.tamanho}
          </span>
          <h3 className="cat-title">{produto.nome}</h3>

          <div className="cat-pricing">
            {isPromo && precoPor ? (
              <>
                <span className="price-from">{formatBrl(precoDe)}</span>
                <span className="price-to">{formatBrl(precoPor)}</span>
              </>
            ) : (
              <span className="price-normal">{formatBrl(precoDe)}</span>
            )}
          </div>
        </div>
      </a>

      <div className="cat-card-footer">
        <button
          type="button"
          className="cat-btn-add"
          onClick={handleAdd}
          title={`Adicionar ${produto.nome} à lista`}
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          Pôr na lista
        </button>
      </div>
    </article>
  );
}
