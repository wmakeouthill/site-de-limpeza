import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CmsShell } from "../../components/CmsShell";
import {
  createCmsDepartamento,
  deleteCmsDepartamento,
  listCmsDepartamentos,
  updateCmsDepartamento,
} from "../../services/cmsCatalog.service";
import type { CmsDepartamento, CmsDepartamentoPayload } from "../../types/cms.types";
import styles from "./CmsDepartmentsPage.module.css";

const ICONES = [
  { value: "home", label: "Casa (home)" },
  { value: "pot", label: "Panela / Cozinha (pot)" },
  { value: "shirt", label: "Camisa / Roupas (shirt)" },
  { value: "drop", label: "Gota / Banheiro (drop)" },
  { value: "roll", label: "Rolo / Descartáveis (roll)" },
  { value: "bucket", label: "Balde / Utensílios (bucket)" },
  { value: "building", label: "Prédio / Condomínio (building)" },
  { value: "cup", label: "Copo / Restaurante (cup)" },
  { value: "store", label: "Loja (store)" },
  { value: "flask", label: "Frasco (flask)" },
  { value: "sparkle", label: "Brilho (sparkle)" },
  { value: "boxes", label: "Caixas (boxes)" },
];

export function CmsDepartmentsPage() {
  const [departamentos, setDepartamentos] = useState<CmsDepartamento[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("drop");
  const [descricao, setDescricao] = useState("");
  const [uso, setUso] = useState("");
  const [cuidado, setCuidado] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await listCmsDepartamentos();
      setDepartamentos(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao listar departamentos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    setEditingId(null);
    setNome("");
    setIcone("drop");
    setDescricao("");
    setUso("");
    setCuidado("");
    setOrdem(departamentos.length + 1);
    setIsActive(true);
    setIsFormOpen(true);
  }

  function handleOpenEdit(dept: CmsDepartamento) {
    setEditingId(dept.id);
    setNome(dept.nome);
    setIcone(dept.icone || "drop");
    setDescricao(dept.descricao || "");
    setUso(dept.uso || "");
    setCuidado(dept.cuidado || "");
    setOrdem(dept.ordem);
    setIsActive(dept.is_active);
    setIsFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payload: CmsDepartamentoPayload = {
      nome,
      icone,
      descricao,
      uso,
      cuidado,
      ordem: Number(ordem),
      is_active: isActive,
    };

    try {
      if (editingId) {
        await updateCmsDepartamento(editingId, payload);
      } else {
        await createCmsDepartamento(payload);
      }
      setIsFormOpen(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao salvar departamento.");
    }
  }

  async function handleDelete(dept: CmsDepartamento) {
    if (!window.confirm(`Deseja excluir o departamento "${dept.nome}"?`)) return;
    try {
      await deleteCmsDepartamento(dept.id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir departamento.");
    }
  }

  return (
    <CmsShell title="Departamentos" crumb="Catálogo / Departamentos">
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Departamentos do Catálogo</h2>
          <button type="button" className={styles.btnPrimary} onClick={handleOpenCreate}>
            <Plus size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Novo Departamento
          </button>
        </div>

        {errorMsg && <div style={{ color: "red", marginBottom: 16 }}>{errorMsg}</div>}

        {isFormOpen && (
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              {editingId ? "Editar Departamento" : "Novo Departamento"}
            </h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="deptNome">Nome *</label>
                <input
                  id="deptNome"
                  className={styles.input}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Cozinha e Desengordurantes"
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="deptIcone">Ícone</label>
                <select
                  id="deptIcone"
                  className={styles.select}
                  value={icone}
                  onChange={(e) => setIcone(e.target.value)}
                >
                  {ICONES.map((ico) => (
                    <option key={ico.value} value={ico.value}>
                      {ico.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="deptOrdem">Ordem</label>
                <input
                  id="deptOrdem"
                  type="number"
                  className={styles.input}
                  value={ordem}
                  onChange={(e) => setOrdem(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="deptUso">Instrução de Uso Geral</label>
                <input
                  id="deptUso"
                  className={styles.input}
                  value={uso}
                  onChange={(e) => setUso(e.target.value)}
                  placeholder="Ex: Dilua conforme o rótulo..."
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="deptCuidado">Aviso de Cuidado Geral</label>
                <input
                  id="deptCuidado"
                  className={styles.input}
                  value={cuidado}
                  onChange={(e) => setCuidado(e.target.value)}
                  placeholder="Ex: Não misture com outros produtos..."
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.btnPrimary}>
                Salvar
              </button>
            </div>
          </form>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ícone</th>
                <th>Nome</th>
                <th>Slug</th>
                <th>Produtos</th>
                <th>Ordem</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "var(--cms-muted, #888)" }}>
                    Carregando departamentos...
                  </td>
                </tr>
              )}
              {!loading && departamentos.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "var(--cms-muted, #888)" }}>
                    Nenhum departamento cadastrado.
                  </td>
                </tr>
              )}
              {departamentos.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 11 }}>
                      {d.icone}
                    </span>
                  </td>
                  <td>
                    <strong>{d.nome}</strong>
                  </td>
                  <td>
                    <code>{d.slug}</code>
                  </td>
                  <td>{d.total_produtos ?? 0}</td>
                  <td>{d.ordem}</td>
                  <td>
                    <span style={{ color: d.is_active ? "#0d8f6f" : "#999", fontWeight: 600 }}>
                      {d.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleOpenEdit(d)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleDelete(d)}
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CmsShell>
  );
}

export default CmsDepartmentsPage;
