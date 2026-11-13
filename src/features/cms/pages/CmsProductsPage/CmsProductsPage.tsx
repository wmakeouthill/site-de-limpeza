import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CmsShell } from "../../components/CmsShell";
import {
  deleteCmsProduto,
  listCmsDepartamentos,
  listCmsProdutos,
  updateCmsProduto,
} from "../../services/cmsCatalog.service";
import type { CmsDepartamento, CmsProduto } from "../../types/cms.types";
import styles from "./CmsProductsPage.module.css";

type TabFilter = "todos" | "ofertas" | "grandes" | "ativos" | "inativos";

export function CmsProductsPage() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<CmsProduto[]>([]);
  const [departamentos, setDepartamentos] = useState<CmsDepartamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("todos");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [depts, prods] = await Promise.all([
        listCmsDepartamentos(),
        listCmsProdutos({
          departamento_id: selectedDept || undefined,
          q: searchTerm || undefined,
          oferta: activeTab === "ofertas" ? true : undefined,
          embalagem_grande: activeTab === "grandes" ? true : undefined,
        }),
      ]);
      setDepartamentos(depts);

      let filtered = prods;
      if (activeTab === "ativos") {
        filtered = filtered.filter((p) => p.is_active);
      } else if (activeTab === "inativos") {
        filtered = filtered.filter((p) => !p.is_active);
      }
      setProdutos(filtered);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDept, searchTerm, activeTab]);

  async function handleToggleActive(prod: CmsProduto) {
    try {
      const updated = await updateCmsProduto(prod.id, { is_active: !prod.is_active });
      setProdutos((prev) => prev.map((p) => (p.id === prod.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao alterar status");
    }
  }

  async function handleDelete(prod: CmsProduto) {
    if (!window.confirm(`Deseja realmente excluir "${prod.nome}"?`)) return;
    try {
      await deleteCmsProduto(prod.id);
      setProdutos((prev) => prev.filter((p) => p.id !== prod.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir produto");
    }
  }

  return (
    <CmsShell
      title="Produtos"
      crumb="Catálogo / Produtos"
      searchPlaceholder="Buscar por nome, marca..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      primaryAction={{ label: "Novo Produto", href: "/cms/produtos/novo" }}
    >
      <div className={styles.page}>
        <div className={styles.filterBar}>
          <div className={styles.filtersLeft}>
            <button
              type="button"
              className={styles.filterButton}
              data-active={activeTab === "todos"}
              onClick={() => setActiveTab("todos")}
            >
              Todos
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={activeTab === "ofertas"}
              onClick={() => setActiveTab("ofertas")}
            >
              Em Oferta
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={activeTab === "grandes"}
              onClick={() => setActiveTab("grandes")}
            >
              Embalagem Grande
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={activeTab === "ativos"}
              onClick={() => setActiveTab("ativos")}
            >
              Ativos
            </button>
            <button
              type="button"
              className={styles.filterButton}
              data-active={activeTab === "inativos"}
              onClick={() => setActiveTab("inativos")}
            >
              Inativos
            </button>
          </div>

          <select
            className={styles.deptSelect}
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            aria-label="Filtrar por departamento"
          >
            <option value="">Todos os Departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && <div style={{ color: "red", marginBottom: 16 }}>{errorMsg}</div>}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Departamento</th>
                <th>Preço</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => {
                const dept = departamentos.find((d) => d.id === p.departamento_id);
                return (
                  <tr key={p.id} className={styles.productRow}>
                    <td>
                      <div className={styles.productCell}>
                        <div
                          className={styles.productDot}
                          style={{ backgroundColor: p.cor || "#003399" }}
                        />
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>
                            {p.nome}
                            {p.embalagem_grande && (
                              <span className={styles.badgeBig}>Grande</span>
                            )}
                          </span>
                          <span className={styles.productMeta}>
                            {p.marca ? `${p.marca} · ` : ""}
                            {p.tamanho || p.forma}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{dept ? dept.nome : p.departamento_nome || "—"}</td>
                    <td>
                      <div className={styles.priceCell}>
                        {p.promo_ativa && p.preco_por ? (
                          <div className={styles.pricePromo}>
                            <span className={styles.priceFrom}>R$ {p.preco_de}</span>
                            <span className={styles.priceTo}>R$ {p.preco_por}</span>
                            {p.desconto_pct && (
                              <span className={styles.badgePromo}>-{p.desconto_pct}%</span>
                            )}
                          </div>
                        ) : (
                          <span className={styles.priceOriginal}>R$ {p.preco_de}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.statusToggle}
                        data-active={p.is_active}
                        onClick={() => handleToggleActive(p)}
                        title={p.is_active ? "Clique para desativar" : "Clique para ativar"}
                      >
                        {p.is_active ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => navigate(`/cms/produtos/${p.id}`)}
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.danger}`}
                          onClick={() => handleDelete(p)}
                          aria-label={`Excluir ${p.nome}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && produtos.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.emptyState}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CmsShell>
  );
}

export default CmsProductsPage;
