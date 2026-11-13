import type { AnalyticsPageList } from "../../types/cms.types";
import { CHANNEL_META, formatNumber } from "../../pages/CmsAnalyticsPage/CmsAnalyticsPage.utils";
import styles from "../../pages/CmsAnalyticsPage/CmsAnalyticsPage.module.css";

interface AnalyticsPagesTableProps {
  pages: AnalyticsPageList;
  isLoading: boolean;
  isFetching?: boolean;
  errorMessage: string | null;
  onPageChange: (page: number) => void;
}

export function AnalyticsPagesTable({ pages, isLoading, isFetching = false, errorMessage, onPageChange }: AnalyticsPagesTableProps) {
  const totalPages = Math.max(1, Math.ceil(pages.total / pages.pageSize));
  return (
    <section className={styles.card} aria-label="Todas as páginas vistas" aria-busy={isFetching}>
      <div className={styles.cardHead}>
        <h2>Todas as páginas vistas</h2>
        <span>{formatNumber(pages.total)} rotas no período</span>
      </div>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      {isLoading ? <p className={styles.empty}>Carregando páginas...</p> : null}
      {!isLoading && !errorMessage && !pages.items.length ? <p className={styles.empty}>Ainda não há páginas vistas para este período.</p> : null}
      {!isLoading && !errorMessage && pages.items.length ? (
        <>
          <div className={styles.pagesTableWrap}>
            <table className={styles.pagesTable}>
              <thead><tr><th>Canal</th><th>Rota</th><th>Visualizações</th></tr></thead>
              <tbody>{pages.items.map((item) => (
                <tr key={`${item.site}:${item.path}`}>
                  <td><span className={styles.siteChip} data-site={item.site}>{CHANNEL_META[item.site].short}</span></td>
                  <td><code title={item.path}>{item.path}</code></td>
                  <td>{formatNumber(item.pageviews)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <footer className={styles.tablePagination}>
            <button type="button" onClick={() => onPageChange(pages.page - 1)} disabled={isFetching || pages.page <= 1}>Anterior</button>
            <span>Página {pages.page} de {totalPages}</span>
            <button type="button" onClick={() => onPageChange(pages.page + 1)} disabled={isFetching || pages.page >= totalPages}>Próxima</button>
          </footer>
        </>
      ) : null}
    </section>
  );
}
