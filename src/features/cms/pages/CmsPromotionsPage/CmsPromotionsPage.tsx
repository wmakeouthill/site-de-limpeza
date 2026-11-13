import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Edit,
  Eye,
  MousePointerClick,
  Plus,
  Power,
  Sparkles,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { CmsShell } from "../../components/CmsShell";
import {
  deleteCmsPromocao,
  listCmsPromocoes,
  updateCmsPromocao,
} from "../../services/cmsPromotions.service";
import type { CmsPromocao, PromocaoSituacao } from "../../types/cms.types";
import styles from "./CmsPromotionsPage.module.css";

function formatBrDate(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

function getSituacaoBadge(situacao: PromocaoSituacao, isActive: boolean) {
  if (!isActive || situacao === "desligada") {
    return <span className={`${styles.badge} ${styles.badgeDesligada}`}>Desligada</span>;
  }
  switch (situacao) {
    case "no_ar":
      return <span className={`${styles.badge} ${styles.badgeNoAr}`}>No ar</span>;
    case "agendada":
      return <span className={`${styles.badge} ${styles.badgeAgendada}`}>Agendada</span>;
    case "encerrada":
      return <span className={`${styles.badge} ${styles.badgeEncerrada}`}>Encerrada</span>;
    default:
      return <span className={styles.badge}>{situacao}</span>;
  }
}

function getAcaoBadge(tipoAcao: string, cupom?: string | null) {
  switch (tipoAcao) {
    case "cupom":
      return (
        <span className={`${styles.badgeSmall} ${styles.badgeCupom}`}>
          <Tag size={11} /> {cupom || "Cupom"}
        </span>
      );
    case "link":
      return <span className={`${styles.badgeSmall} ${styles.badgeLink}`}>Link</span>;
    case "produto":
      return <span className={`${styles.badgeSmall} ${styles.badgeProduto}`}>Produto</span>;
    default:
      return <span className={`${styles.badgeSmall} ${styles.badgeAviso}`}>Aviso</span>;
  }
}

export function CmsPromotionsPage() {
  const [promocoes, setPromocoes] = useState<CmsPromocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listCmsPromocoes();
      setPromocoes(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar promoções");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleActive(p: CmsPromocao) {
    try {
      const updated = await updateCmsPromocao(p.id, { is_active: !p.is_active });
      setPromocoes((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao alternar status da promoção");
    }
  }

  async function handleDelete(p: CmsPromocao) {
    if (!window.confirm(`Deseja realmente excluir a promoção "${p.titulo}"?`)) {
      return;
    }
    try {
      await deleteCmsPromocao(p.id);
      setPromocoes((prev) => prev.filter((item) => item.id !== p.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir promoção");
    }
  }

  const filteredPromocoes = promocoes.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.titulo.toLowerCase().includes(term) ||
      (p.codigo_cupom && p.codigo_cupom.toLowerCase().includes(term)) ||
      (p.texto && p.texto.toLowerCase().includes(term))
    );
  });

  return (
    <CmsShell
      title="Promoções de Entrada"
      crumb="Divulgação & Conteúdo / Promoções"
      searchPlaceholder="Buscar por título ou cupom..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      primaryAction={{ label: "Nova promoção", href: "/cms/promocoes/nova" }}
    >
      <div className={styles.container}>
        {errorMsg && (
          <div className={styles.errorAlert} role="alert" data-testid="error-alert">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className={styles.loadingBox}>Carregando promoções...</div>
        ) : filteredPromocoes.length === 0 ? (
          <div className={styles.emptyState}>
            <Sparkles size={40} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Nenhuma promoção encontrada</h3>
            <p className={styles.emptyDesc}>
              {searchTerm
                ? "Nenhum resultado corresponde à sua busca."
                : "Crie sua primeira promoção de entrada para exibir avisos ou cupons de desconto aos visitantes."}
            </p>
            <Link to="/cms/promocoes/nova" className={styles.newPromoBtn}>
              <Plus size={16} /> Nova promoção
            </Link>
          </div>
        ) : (
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Promoção</th>
                  <th>Situação</th>
                  <th>Público & Frequência</th>
                  <th>Período</th>
                  <th>Prioridade</th>
                  <th>Métricas</th>
                  <th className={styles.thActions}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromocoes.map((p) => (
                  <tr key={p.id} className={!p.is_active ? styles.rowInactive : undefined}>
                    <td className={styles.tdMain}>
                      <div className={styles.titleLine}>
                        <strong className={styles.promoTitle}>{p.titulo}</strong>
                        {getAcaoBadge(p.tipo_acao, p.codigo_cupom)}
                      </div>
                      {p.texto && <div className={styles.promoDescSnippet}>{p.texto}</div>}
                    </td>

                    <td>{getSituacaoBadge(p.situacao, p.is_active)}</td>

                    <td>
                      <div className={styles.publicoInfo}>
                        <span className={styles.infoRow}>
                          <Users size={13} />{" "}
                          {p.publico === "casa"
                            ? "Casa"
                            : p.publico === "empresa"
                              ? "Empresa"
                              : "Todos"}
                        </span>
                        <span className={styles.infoRowMuted}>
                          {p.frequencia === "uma_vez"
                            ? "Uma vez"
                            : p.frequencia === "diaria"
                              ? "Diária"
                              : "Sempre"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className={styles.periodoInfo}>
                        <span>{formatBrDate(p.data_inicio)}</span>
                        <span className={styles.periodoSep}>até</span>
                        <span>{formatBrDate(p.data_fim)}</span>
                      </div>
                    </td>

                    <td>
                      <span className={styles.prioridadeTag}>{p.prioridade}</span>
                    </td>

                    <td>
                      <div className={styles.metricasContainer}>
                        <span className={styles.metricaItem} title="Visualizações">
                          <Eye size={12} /> {p.views_count ?? 0}
                        </span>
                        <span className={styles.metricaItem} title="Cliques no CTA">
                          <MousePointerClick size={12} /> {p.clicks_count ?? 0}
                        </span>
                        <span className={styles.metricaItemPct} title="Taxa de Cliques">
                          {p.taxa_clique_pct ?? 0}%
                        </span>
                      </div>
                    </td>

                    <td className={styles.tdActions}>
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${
                          p.is_active ? styles.btnActive : styles.btnInactive
                        }`}
                        onClick={() => handleToggleActive(p)}
                        title={p.is_active ? "Desativar promoção" : "Ativar promoção"}
                        aria-label={p.is_active ? "Desativar promoção" : "Ativar promoção"}
                      >
                        <Power size={15} />
                      </button>

                      <Link
                        to={`/cms/promocoes/${p.id}`}
                        className={styles.actionIconBtn}
                        title="Editar promoção"
                        aria-label="Editar promoção"
                      >
                        <Edit size={15} />
                      </Link>

                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.btnDanger}`}
                        onClick={() => handleDelete(p)}
                        title="Excluir promoção"
                        aria-label="Excluir promoção"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
