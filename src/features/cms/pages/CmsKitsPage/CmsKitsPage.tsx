import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CmsShell } from "../../components/CmsShell";
import {
  createCmsKit,
  deleteCmsKit,
  listCmsKits,
  listCmsProdutos,
} from "../../services/cmsCatalog.service";
import type { CmsKit, CmsKitPayload, CmsProduto } from "../../types/cms.types";
import styles from "./CmsKitsPage.module.css";

const PUBLICOS = [
  { value: "condominio", label: "Condomínio" },
  { value: "restaurante", label: "Restaurante" },
  { value: "salao", label: "Salão de Beleza" },
  { value: "escritorio", label: "Escritório" },
  { value: "empresa", label: "Geral / Empresa" },
];

export function CmsKitsPage() {
  const [kits, setKits] = useState<CmsKit[]>([]);
  const [produtos, setProdutos] = useState<CmsProduto[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form state
  const [nome, setNome] = useState("");
  const [publico, setPublico] = useState("condominio");
  const [descricao, setDescricao] = useState("");
  const [ordem, setOrdem] = useState(1);
  const [itens, setItens] = useState<Array<{ produto_id: string; quantidade: number }>>([]);
  const [selectedProdId, setSelectedProdId] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [kitsData, prodsData] = await Promise.all([
        listCmsKits(),
        listCmsProdutos({ only_active: true } as any),
      ]);
      setKits(kitsData);
      setProdutos(prodsData);
      if (prodsData.length > 0) {
        setSelectedProdId(prodsData[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar kits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleAddItem() {
    if (!selectedProdId) return;
    setItens((prev) => [
      ...prev.filter((i) => i.produto_id !== selectedProdId),
      { produto_id: selectedProdId, quantidade: Number(selectedQty) || 1 },
    ]);
  }

  function handleRemoveItem(prodId: string) {
    setItens((prev) => prev.filter((i) => i.produto_id !== prodId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0) {
      setErrorMsg("Adicione ao menos um produto ao kit.");
      return;
    }

    const payload: CmsKitPayload = {
      nome,
      publico,
      descricao,
      ordem: Number(ordem),
      itens: itens.map((item, idx) => ({ ...item, ordem: idx + 1 })),
    };

    try {
      await createCmsKit(payload);
      setIsFormOpen(false);
      setNome("");
      setDescricao("");
      setItens([]);
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao criar kit.");
    }
  }

  async function handleDelete(kit: CmsKit) {
    if (!window.confirm(`Deseja excluir o kit "${kit.nome}"?`)) return;
    try {
      await deleteCmsKit(kit.id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir kit.");
    }
  }

  return (
    <CmsShell title="Kits" crumb="Catálogo / Kits">
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Kits Corporativos</h2>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setIsFormOpen((v) => !v)}
          >
            <Plus size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            {isFormOpen ? "Fechar Formulário" : "Novo Kit"}
          </button>
        </div>

        {errorMsg && <div style={{ color: "red", marginBottom: 16 }}>{errorMsg}</div>}

        {isFormOpen && (
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Criar Novo Kit</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="kitNome">Nome do Kit *</label>
                <input
                  id="kitNome"
                  className={styles.input}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Kit Restaurante e Cozinha"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="kitPublico">Público / Segmento</label>
                <select
                  id="kitPublico"
                  className={styles.select}
                  value={publico}
                  onChange={(e) => setPublico(e.target.value)}
                >
                  {PUBLICOS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="kitOrdem">Ordem</label>
                <input
                  id="kitOrdem"
                  type="number"
                  className={styles.input}
                  value={ordem}
                  onChange={(e) => setOrdem(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.field} style={{ marginBottom: 16 }}>
              <label htmlFor="kitDesc">Descrição curta</label>
              <input
                id="kitDesc"
                className={styles.input}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Áreas comuns, garagem e lixeira · por mês"
              />
            </div>

            <div className={styles.itemBuilder}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Produtos do Kit ({itens.length})
              </h4>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
                <div className={styles.field} style={{ flex: 1 }}>
                  <label htmlFor="itemProd">Selecione o Produto</label>
                  <select
                    id="itemProd"
                    className={styles.select}
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                  >
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.tamanho || p.marca})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field} style={{ width: 90 }}>
                  <label htmlFor="itemQtd">Qtd</label>
                  <input
                    id="itemQtd"
                    type="number"
                    min="1"
                    className={styles.input}
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value)))}
                  />
                </div>

                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleAddItem}
                  style={{ height: 36 }}
                >
                  Adicionar
                </button>
              </div>

              {itens.length > 0 && (
                <ul className={styles.itemList}>
                  {itens.map((it) => {
                    const prod = produtos.find((p) => p.id === it.produto_id);
                    return (
                      <li key={it.produto_id} className={styles.itemRow}>
                        <span>
                          {prod ? prod.nome : it.produto_id}{" "}
                          <span style={{ color: "#777" }}>({prod?.tamanho})</span>
                        </span>
                        <div>
                          <span className={styles.itemQty}>{it.quantidade}x</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.produto_id)}
                            style={{
                              marginLeft: 8,
                              background: "none",
                              border: "none",
                              color: "#d64545",
                              cursor: "pointer",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ background: "#777" }}
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary}>
                Salvar Kit
              </button>
            </div>
          </form>
        )}

        <div className={styles.kitGrid}>
          {loading && (
            <p style={{ color: "var(--cms-muted, #888)", gridColumn: "1 / -1" }}>
              Carregando kits...
            </p>
          )}
          {!loading && kits.length === 0 && (
            <p style={{ color: "var(--cms-muted, #888)", gridColumn: "1 / -1" }}>
              Nenhum kit cadastrado.
            </p>
          )}
          {kits.map((kit) => (
            <div key={kit.id} className={styles.kitCard}>
              <div className={styles.kitHeader}>
                <span className={styles.kitTitle}>{kit.nome}</span>
                <span className={styles.publicBadge}>{kit.publico}</span>
              </div>
              <p className={styles.kitDesc}>{kit.descricao}</p>

              <ul className={styles.itemList}>
                {kit.itens.map((it) => (
                  <li key={it.id} className={styles.itemRow}>
                    <span>{it.produto ? it.produto.nome : "Produto"}</span>
                    <span className={styles.itemQty}>{it.quantidade}x</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => handleDelete(kit)}
              >
                <Trash2 size={13} style={{ display: "inline", marginRight: 4 }} />
                Excluir Kit
              </button>
            </div>
          ))}
        </div>
      </div>
    </CmsShell>
  );
}

export default CmsKitsPage;
