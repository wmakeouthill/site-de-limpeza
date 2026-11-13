import { Edit, Flame, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { CmsShell } from "../../components/CmsShell";
import {
  listCmsDepartamentos,
  listCmsProdutos,
  updateCmsProduto,
} from "../../services/cmsCatalog.service";
import type { CmsDepartamento, CmsProduto } from "../../types/cms.types";
import styles from "./CmsOffersPage.module.css";

export function CmsOffersPage() {
  const [produtos, setProdutos] = useState<CmsProduto[]>([]);
  const [departamentos, setDepartamentos] = useState<CmsDepartamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [depts, prods] = await Promise.all([
        listCmsDepartamentos(),
        listCmsProdutos({ oferta: true, q: searchTerm || undefined }),
      ]);
      setDepartamentos(depts);
      setProdutos(prods);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar ofertas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const deptMap = new Map(departamentos.map((d) => [d.id, d.nome]));

  function formatMoney(val?: string | number | null) {
    if (val == null || val === "") return "-";
    const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (isNaN(num)) return String(val);
    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDate(iso?: string | null) {
    if (!iso) return "Sem limite";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  }

  function getOfferStatus(p: CmsProduto): { label: string; active: boolean } {
    const now = new Date();
    if (p.promo_inicio && new Date(p.promo_inicio) > now) {
      return { label: "Agendada", active: false };
    }
    if (p.promo_fim && new Date(p.promo_fim) < now) {
      return { label: "Encerrada", active: false };
    }
    return { label: "Ativa", active: true };
  }

  async function handleEndOffer(prod: CmsProduto) {
    if (!window.confirm(`Deseja realmente encerrar a oferta de "${prod.nome}"?`)) {
      return;
    }
    try {
      await updateCmsProduto(prod.id, {
        preco_por: null,
        promo_inicio: null,
        promo_fim: null,
      });
      setProdutos((prev) => prev.filter((p) => p.id !== prod.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao encerrar oferta");
    }
  }

  return (
    <CmsShell
      title="Ofertas da Semana"
      crumb="Catálogo / Ofertas"
      searchPlaceholder="Buscar em ofertas..."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      primaryAction={{ label: "Gerenciar Produtos", href: "/cms/produtos" }}
    >
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
              Produtos com Preço Promocional
            </h2>
            <p style={{ fontSize: "13px", color: "var(--cms-muted, #666)", margin: "4px 0 0" }}>
              Produtos cadastrados com desconto ativo ou agendado no catálogo.
            </p>
          </div>
          <Link to="/cms/produtos" className={styles.btnPrimary}>
            <Tag size={16} />
            Aplicar Nova Oferta
          </Link>
        </div>

        {errorMsg && (
          <div style={{ padding: "12px", background: "rgba(214, 69, 69, 0.1)", color: "#d64545", borderRadius: "6px", marginBottom: "16px", fontSize: "13px" }}>
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--cms-muted, #888)" }}>
            Carregando ofertas...
          </div>
        ) : produtos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "var(--cms-panel, #fff)", border: "1px dashed var(--cms-border, rgba(0,0,0,0.15))", borderRadius: "8px" }}>
            <Flame size={36} color="var(--cms-muted, #aaa)" style={{ marginBottom: "12px" }} />
            <h3 style={{ fontSize: "1rem", margin: "0 0 6px" }}>Nenhuma oferta encontrada</h3>
            <p style={{ fontSize: "13px", color: "var(--cms-muted, #777)", margin: "0 0 16px" }}>
              Edite um produto na lista de produtos para definir o preço promocional "De / Por".
            </p>
            <Link to="/cms/produtos" className={styles.btnPrimary}>
              Ir para Lista de Produtos
            </Link>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Departamento</th>
                  <th>Preço De</th>
                  <th>Preço Por</th>
                  <th>Desconto</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const status = getOfferStatus(p);
                  const precoDe = p.preco_de;
                  const precoPor = p.preco_por;
                  const numDe = typeof precoDe === "number" ? precoDe : parseFloat(String(precoDe).replace(",", "."));
                  const numPor = typeof precoPor === "number" ? precoPor : parseFloat(String(precoPor).replace(",", "."));
                  let descontoPercentual = p.desconto_pct ?? 0;
                  if (!descontoPercentual && numDe && numPor && numDe > numPor) {
                    descontoPercentual = Math.round(((numDe - numPor) / numDe) * 100);
                  }

                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nome}</strong>
                        {p.tamanho && (
                          <span style={{ fontSize: "12px", color: "var(--cms-muted, #888)", marginLeft: "6px" }}>
                            ({p.tamanho})
                          </span>
                        )}
                      </td>
                      <td>{p.departamento_id ? deptMap.get(p.departamento_id) || "-" : "-"}</td>
                      <td style={{ textDecoration: "line-through", color: "var(--cms-muted, #888)" }}>
                        {formatMoney(precoDe)}
                      </td>
                      <td style={{ fontWeight: 700, color: "#0d8f6f" }}>
                        {formatMoney(precoPor)}
                      </td>
                      <td>
                        {descontoPercentual > 0 ? (
                          <span style={{ fontWeight: 700, color: "#d64545", background: "rgba(214, 69, 69, 0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>
                            -{descontoPercentual}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--cms-muted, #666)" }}>
                        {formatDate(p.promo_inicio)} até {formatDate(p.promo_fim)}
                      </td>
                      <td>
                        <span className={status.active ? styles.badgeActive : styles.badgeInactive}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <Link
                            to={`/cms/produtos/${p.id}`}
                            className={styles.btnAction}
                            title="Editar produto"
                          >
                            <Edit size={14} style={{ marginRight: "4px" }} />
                            Editar
                          </Link>
                          <button
                            type="button"
                            className={`${styles.btnAction} ${styles.btnEndOffer}`}
                            onClick={() => handleEndOffer(p)}
                            title="Remover preço promocional"
                          >
                            <Trash2 size={14} style={{ marginRight: "4px" }} />
                            Encerrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CmsShell>
  );
}
