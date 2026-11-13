import { ArchiveRestore, Eye, Plus, Save, Send, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsField } from "../../components/CmsField";
import { CmsShell } from "../../components/CmsShell";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { listCmsProdutos } from "../../services/cmsCatalog.service";
import {
  archiveCmsGuide,
  createCmsGuide,
  getCmsGuide,
  publishCmsGuide,
  unarchiveCmsGuide,
  unpublishCmsGuide,
  updateCmsGuide,
} from "../../services/cmsGuide.service";
import type {
  CmsContentStatus,
  CmsGuide,
  CmsGuidePayload,
  CmsGuideProduto,
  CmsProduto,
  CmsPublicoGuia,
} from "../../types/cms.types";
import styles from "./GuideEditorPage.module.css";

const EMPTY_GUIDE: CmsGuidePayload = {
  site: "falcao",
  slug: "",
  title: "",
  excerpt: "",
  bodyMarkdown: "",
  seoTitle: "",
  seoDescription: "",
  coverAssetId: null,
  publico: "todos",
  tempoMinutos: 15,
  etiqueta: "",
  icone: "sparkle",
  dificuldade: "Fácil",
  produtos: [],
  authorName: "Equipe Falcão Limpeza",
  authorEmail: null,
  authorImageUrl: "",
};

export function GuideEditorPage() {
  return (
    <CmsAuthGuard>
      <CmsShell>
        <GuideEditorView />
      </CmsShell>
    </CmsAuthGuard>
  );
}

function GuideEditorView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewGuide = !id || id === "novo";
  const [guideId, setGuideId] = useState<string | null>(isNewGuide ? null : id);
  const [status, setStatus] = useState<CmsContentStatus>("draft");
  const [form, setForm] = useState<CmsGuidePayload>(EMPTY_GUIDE);
  const [guideProdutos, setGuideProdutos] = useState<CmsGuideProduto[]>([]);
  const [availableProdutos, setAvailableProdutos] = useState<CmsProduto[]>([]);
  const [selectedProdId, setSelectedProdId] = useState<string>("");
  const [selectedProdQtd, setSelectedProdQtd] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(!isNewGuide);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    listCmsProdutos()
      .then((prods) => {
        if (!isMounted) return;
        setAvailableProdutos(prods);
        if (prods.length > 0) {
          setSelectedProdId(prods[0].id);
        }
      })
      .catch(() => {});

    if (isNewGuide || !id) {
      return () => {
        isMounted = false;
      };
    }

    getCmsGuide(id)
      .then((guideEntry) => {
        if (!isMounted) return;
        setGuideId(guideEntry.id);
        setStatus(guideEntry.status);
        setForm(toForm(guideEntry));
        setGuideProdutos(guideEntry.produtos ?? []);
      })
      .catch(() => {
        if (isMounted) setMessage("Não foi possível carregar o guia.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isNewGuide]);

  function handleChange(
    field: keyof Omit<CmsGuidePayload, "produtos" | "coverAssetId">,
  ) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      const val =
        field === "tempoMinutos" ? Number(event.target.value) : event.target.value;
      setForm((curr) => ({ ...curr, [field]: val }));
    };
  }

  function handleAddProduto() {
    if (!selectedProdId) return;
    const found = availableProdutos.find((p) => p.id === selectedProdId);
    if (!found) return;

    if (guideProdutos.some((gp) => gp.produto_id === selectedProdId)) {
      setMessage("Este produto já foi adicionado à lista.");
      return;
    }

    const newGp: CmsGuideProduto = {
      produto_id: found.id,
      nome: found.nome,
      slug: found.slug,
      quantidade: selectedProdQtd > 0 ? selectedProdQtd : 1,
      ordem: guideProdutos.length,
      preco_atual: found.preco_atual,
      preco_de: found.preco_de,
      preco_por: found.preco_por,
      is_active: found.is_active,
      imagem_url: found.imagem_url,
      forma: found.forma,
      cor: found.cor,
      tamanho: found.tamanho,
    };

    const updatedList = [...guideProdutos, newGp];
    setGuideProdutos(updatedList);
    setForm((curr) => ({
      ...curr,
      produtos: updatedList.map((p, idx) => ({
        produto_id: p.produto_id,
        quantidade: p.quantidade,
        ordem: idx,
      })),
    }));
    setSelectedProdQtd(1);
    setMessage(null);
  }

  function handleRemoveProduto(prodId: string) {
    const updatedList = guideProdutos.filter((gp) => gp.produto_id !== prodId);
    setGuideProdutos(updatedList);
    setForm((curr) => ({
      ...curr,
      produtos: updatedList.map((p, idx) => ({
        produto_id: p.produto_id,
        quantidade: p.quantidade,
        ordem: idx,
      })),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setMessage("O título do guia é obrigatório.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const payload: CmsGuidePayload = {
      ...form,
      produtos: guideProdutos.map((p, idx) => ({
        produto_id: p.produto_id,
        quantidade: p.quantidade,
        ordem: idx,
      })),
    };

    try {
      if (!guideId) {
        const created = await createCmsGuide(payload);
        setGuideId(created.id);
        setStatus(created.status);
        setMessage("Guia criado com sucesso.");
        navigate(`/cms/guias/${created.id}`, { replace: true });
      } else {
        const updated = await updateCmsGuide(guideId, payload);
        setStatus(updated.status);
        setMessage("Guia salvo com sucesso.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar guia.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublicationToggle() {
    if (!guideId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated =
        status === "archived"
          ? await unarchiveCmsGuide(guideId)
          : status === "published"
            ? await unpublishCmsGuide(guideId)
            : await publishCmsGuide(guideId);
      setStatus(updated.status);
      setMessage(
        updated.status === "published"
          ? "Guia publicado com sucesso."
          : updated.status === "archived"
            ? "Guia arquivado."
            : "Guia em rascunho.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro na publicação.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className={styles.page}>Carregando...</main>;
  }

  const previewHref = form.slug ? `/guias/${form.slug}` : "#";

  return (
    <main className={styles.page}>
      <form className={styles.editor} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <span>Guia Passo a Passo</span>
            <h1>{isNewGuide ? "Novo Guia de Limpeza" : form.title || "Editar Guia"}</h1>
          </div>
          <div className={styles.actions}>
            {guideId && (
              <a href={previewHref} target="_blank" rel="noreferrer">
                <Eye size={18} />
                Visualizar no site
              </a>
            )}
            {guideId && (
              <button type="button" onClick={handlePublicationToggle} disabled={isSaving}>
                {status === "archived" ? <ArchiveRestore size={18} /> : <Send size={18} />}
                {status === "archived"
                  ? "Restaurar"
                  : status === "published"
                    ? "Despublicar"
                    : "Publicar"}
              </button>
            )}
            <button type="submit" disabled={isSaving}>
              <Save size={18} />
              Salvar
            </button>
          </div>
        </header>

        {message && <p className={styles.message}>{message}</p>}

        <div className={styles.meta}>
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Identidade do Guia</h2>
              <p>Título, endereço amigável (slug) e introdução rápida.</p>
            </header>
            <div className={styles.fields}>
              <CmsField label="Título do Guia" hint="Ex: Como Limpar Chapa de Hamburgueria">
                <input value={form.title} onChange={handleChange("title")} required />
              </CmsField>
              <CmsField label="Slug amigável" hint="como-limpar-chapa-hamburgueria">
                <input value={form.slug} onChange={handleChange("slug")} required />
              </CmsField>
              <CmsField label="Resumo / Introdução" hint="Breve parágrafo explicativo">
                <textarea value={form.excerpt} rows={3} onChange={handleChange("excerpt")} />
              </CmsField>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Metadados Operacionais</h2>
              <p>Público-alvo, tempo de execução, etiqueta e nível de dificuldade.</p>
            </header>
            <div className={styles.threeColumns}>
              <CmsField label="Público">
                <select
                  value={form.publico}
                  onChange={handleChange("publico")}
                  data-testid="guide-publico-select"
                >
                  <option value="todos">Todos</option>
                  <option value="casa">Casa</option>
                  <option value="empresa">Empresa</option>
                </select>
              </CmsField>
              <CmsField label="Tempo estimado (minutos)">
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={form.tempoMinutos}
                  onChange={handleChange("tempoMinutos")}
                  required
                />
              </CmsField>
              <CmsField label="Dificuldade">
                <select value={form.dificuldade} onChange={handleChange("dificuldade")}>
                  <option value="Fácil">Fácil</option>
                  <option value="Média">Média</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </CmsField>
            </div>
            <div className={styles.twoColumns}>
              <CmsField label="Etiqueta temática" hint="Ex: Chapa & Coifa, Piso Encardido">
                <input
                  value={form.etiqueta}
                  onChange={handleChange("etiqueta")}
                  placeholder="Chapa & Coifa"
                />
              </CmsField>
              <CmsField label="Ícone">
                <select value={form.icone} onChange={handleChange("icone")}>
                  <option value="sparkle">Brilho (sparkle)</option>
                  <option value="drop">Gota (drop)</option>
                  <option value="pot">Panela / Chapa (pot)</option>
                  <option value="spray">Spray / Pulverizador (spray)</option>
                  <option value="shield">Proteção (shield)</option>
                </select>
              </CmsField>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>O que você vai precisar (Insumos e Produtos)</h2>
              <p>Vincule produtos do catálogo que o cliente pode adicionar à lista de uma só vez (CA-18).</p>
            </header>
            <div className={styles.productAdder}>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                data-testid="product-select"
              >
                {availableProdutos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.is_active ? `R$ ${p.preco_atual}` : "(Inativo)"}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="99"
                value={selectedProdQtd}
                onChange={(e) => setSelectedProdQtd(Number(e.target.value))}
                data-testid="product-qtd-input"
              />
              <button
                type="button"
                onClick={handleAddProduto}
                data-testid="add-product-btn"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>

            <div className={styles.productsList} data-testid="guide-products-list">
              {guideProdutos.map((gp) => (
                <div key={gp.produto_id} className={styles.productRow}>
                  <div className={styles.productInfo}>
                    <span className={styles.productName}>{gp.nome}</span>
                    <span className={styles.productMeta}>
                      Qtd: {gp.quantidade}x • {gp.preco_atual ? `R$ ${gp.preco_atual}` : ""}
                    </span>
                    <span
                      className={
                        gp.is_active !== false
                          ? styles.productBadgeActive
                          : styles.productBadgeInactive
                      }
                    >
                      {gp.is_active !== false ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => handleRemoveProduto(gp.produto_id)}
                    title="Remover produto do guia"
                    data-testid={`remove-prod-${gp.produto_id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {guideProdutos.length === 0 && (
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
                  Nenhum produto vinculado ainda.
                </p>
              )}
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Passo a Passo (Conteúdo)</h2>
              <p>Instruções em Markdown com suporte a caixas de destaque (&gt; [!TIP], &gt; [!WARNING]) e tabelas.</p>
            </header>
            <MarkdownEditor
              value={form.bodyMarkdown}
              onChange={(value) => setForm((curr) => ({ ...curr, bodyMarkdown: value }))}
            />
          </section>
        </div>
      </form>
    </main>
  );
}

function toForm(guide: CmsGuide): CmsGuidePayload {
  return {
    site: guide.site,
    slug: guide.slug,
    title: guide.title,
    excerpt: guide.excerpt,
    bodyMarkdown: guide.bodyMarkdown,
    coverAssetId: guide.coverAssetId,
    seoTitle: guide.seoTitle,
    seoDescription: guide.seoDescription,
    publico: guide.publico,
    tempoMinutos: guide.tempoMinutos,
    etiqueta: guide.etiqueta,
    icone: guide.icone,
    dificuldade: guide.dificuldade,
    produtos: (guide.produtos ?? []).map((p, idx) => ({
      produto_id: p.produto_id,
      quantidade: p.quantidade,
      ordem: idx,
    })),
    authorName: guide.authorName,
    authorEmail: guide.authorEmail,
    authorImageUrl: guide.authorImageUrl,
  };
}
