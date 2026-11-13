import { ArchiveRestore, Eye, Plus, Save, Send, Trash2, X } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CaseShowcaseCard } from "@/shared/components/CaseShowcaseCard";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsField } from "../../components/CmsField";
import { CmsShell } from "../../components/CmsShell";
import { ImagePositionControl } from "../../components/ImagePositionControl";
import { ImageUploadField } from "../../components/ImageUploadField";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import {
  createCmsCase,
  getCmsCase,
  publishCmsCase,
  unarchiveCmsCase,
  unpublishCmsCase,
  updateCmsCase,
} from "../../services/cmsCase.service";
import type { CmsCase, CmsCasePayload } from "../../types/cms.types";
import { getPublicCaseHref } from "../../utils/publicPreviewUrl";
import styles from "./CaseEditorPage.module.css";

const EMPTY_CASE: CmsCasePayload = {
  site: "falcao",
  slug: "",
  title: "",
  excerpt: "",
  bodyMarkdown: "",
  seoTitle: "",
  seoDescription: "",
  topic: "",
  clientName: "",
  screenshotAssetId: null,
  screenshotUrl: "",
  screenshotPosition: { x: 50, y: 50, zoom: 100 },
  tags: [{ label: "" }],
};

type CmsCaseTextField = "topic" | "title" | "slug" | "excerpt" | "seoTitle" | "seoDescription";

export function CaseEditorPage() {
  return (
    <CmsAuthGuard>
      <CmsShell>
        <CaseEditorView />
      </CmsShell>
    </CmsAuthGuard>
  );
}

function CaseEditorView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewCase = !id || id === "novo";
  const [caseId, setCaseId] = useState<string | null>(isNewCase ? null : id);
  const [status, setStatus] = useState<CmsCase["status"]>("draft");
  const [form, setForm] = useState<CmsCasePayload>(EMPTY_CASE);
  const [isLoading, setIsLoading] = useState(!isNewCase);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false);
  const publicHref = form.slug ? getPublicCaseHref("falcao", form.slug) : undefined;

  useEffect(() => {
    if (isNewCase || !id) {
      return;
    }

    let isMounted = true;
    getCmsCase(id)
      .then((caseEntry) => {
        if (!isMounted) {
          return;
        }
        setCaseId(caseEntry.id);
        setStatus(caseEntry.status);
        setForm(toForm(caseEntry));
      })
      .catch(() => {
        if (isMounted) {
          setMessage("Nao foi possivel carregar o guia.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, isNewCase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.topic.trim()) {
      setMessage("O campo Tema / Área Penal é obrigatório.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const payload = normalizePayload(form);
      const savedCase = caseId
        ? await updateCmsCase(caseId, payload)
        : await createCmsCase(payload);
      setCaseId(savedCase.id);
      setStatus(savedCase.status);
      setForm(toForm(savedCase));
      setMessage("Rascunho salvo.");
      if (!caseId) {
        navigate(`/cms/guias/${savedCase.id}`, { replace: true });
      }
    } catch (error) {
      setMessage(getCmsErrorMessage(error, "Nao foi possivel salvar o guia."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublicationToggle() {
    if (!caseId) {
      return;
    }

    if (!form.topic.trim()) {
      setMessage("Informe o Tema / Área Penal antes de publicar.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      if (status !== "published" && status !== "archived") {
        const savedCase = await updateCmsCase(caseId, normalizePayload(form));
        setForm(toForm(savedCase));
        setStatus(savedCase.status);
      }

      const updatedCase =
        status === "archived"
          ? await unarchiveCmsCase(caseId)
          : status === "published"
            ? await unpublishCmsCase(caseId)
            : await publishCmsCase(caseId);
      setStatus(updatedCase.status);
      setMessage(getCaseStatusMessage(updatedCase.status));
    } catch (error) {
      setMessage(getCmsErrorMessage(error, "Nao foi possivel alterar a publicacao."));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <main className={styles.page}>Carregando...</main>;
  }

  return (
    <main className={styles.page}>
      <form className={styles.editor} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <span>Guia de defesa · Falcão Limpeza</span>
            <h1>{isNewCase ? "Novo guia" : form.title || "Editar guia"}</h1>
          </div>
          <div className={styles.actions}>
            {caseId && publicHref && (
              <a href={publicHref} target="_blank" rel="noreferrer">
                <Eye size={18} />
                Preview
              </a>
            )}
            {caseId && (
              <button type="button" onClick={handlePublicationToggle} disabled={isSaving}>
                {status === "archived" ? <ArchiveRestore size={18} /> : <Send size={18} />}
                {getCasePrimaryActionLabel(status)}
              </button>
            )}
            <button type="button" onClick={() => setIsCardPreviewOpen(true)}>
              <Eye size={18} />
              Preview do card
            </button>
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
              <h2>Identidade</h2>
              <p>Tema, título e metadados fundamentais do guia de defesa criminal.</p>
            </header>
            <div className={styles.fields}>
              <CmsField
                label="Tema / Área Penal"
                hint="Ex: Operações Policiais, Audiência de Custódia, Habeas Corpus"
              >
                <input
                  value={form.topic}
                  onChange={handleChange("topic")}
                  placeholder="Ex: Defesa em Operações Policiais"
                  required
                />
              </CmsField>
              <CmsField label="Título" hint="Nome do guia que aparece no card e na página">
                <input
                  value={form.title}
                  onChange={handleChange("title")}
                  placeholder="Ex: Guia Completo de Defesa em Operações Policiais"
                  required
                />
              </CmsField>
              <CmsField
                label="Slug"
                hint="exemplo-do-guia"
                tooltip="Use apenas minúsculas, números e hífens."
              >
                <input
                  value={form.slug}
                  onChange={handleChange("slug")}
                  placeholder="guia-operacao-policial"
                  required
                />
              </CmsField>
              <CmsField
                label="Resumo"
                hint="Subtítulo e resumo prático; vira também a descrição SEO"
              >
                <textarea
                  value={form.excerpt}
                  rows={3}
                  onChange={handleChange("excerpt")}
                  placeholder="Orientações e garantias processuais em investigações criminais."
                />
              </CmsField>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Imagem de capa</h2>
              <p>Imagem de destaque exibida no card e na abertura do guia.</p>
            </header>
            <div className={styles.fields}>
              <div className={styles.imageField}>
                <ImageUploadField
                  label="Capa do guia"
                  value={form.screenshotUrl}
                  onChange={(url, assetId) =>
                    setForm((current) => ({
                      ...current,
                      screenshotUrl: url,
                      screenshotAssetId: assetId,
                    }))
                  }
                />
                <span className={styles.fieldHint}>
                  Aparece no card da listagem e como destaque da leitura do guia
                </span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Tags / Áreas do guia</h2>
              <p>Badges de classificação do guia no site.</p>
            </header>
            <div className={styles.fields}>
              <RepeaterHeader label="Badges / Tags" onAdd={addTag} />
              <div className={styles.repeater}>
                {form.tags.map((tag, index) => (
                  <div className={styles.tagRow} key={`tag-${index}`}>
                    <input
                      value={tag.label}
                      onChange={handleTagChange(index)}
                      placeholder="Direito Penal"
                      required
                    />
                    <button type="button" onClick={() => removeTag(index)} aria-label="Remover tag">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Conteúdo</h2>
              <p>Orientações práticas e texto completo do guia de defesa.</p>
            </header>
            <div className={styles.contentField}>
              <CmsField label="Conteúdo" as="div">
                <MarkdownEditor
                  value={form.bodyMarkdown}
                  onChange={(markdown) =>
                    setForm((current) => ({ ...current, bodyMarkdown: markdown }))
                  }
                />
              </CmsField>
            </div>
          </section>
        </div>
      </form>

      {isCardPreviewOpen && (
        <CasePreviewModal
          form={form}
          publicHref={publicHref}
          onPositionChange={(screenshotPosition) =>
            setForm((currentForm) => ({ ...currentForm, screenshotPosition }))
          }
          onClose={() => setIsCardPreviewOpen(false)}
        />
      )}
    </main>
  );

  function handleChange(field: CmsCaseTextField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const val = event.target.value;
      setForm((currentForm) => ({
        ...currentForm,
        [field]: val,
        ...(field === "topic" ? { clientName: val } : {}),
      }));
    };
  }

  function handleTagChange(index: number) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((currentForm) => ({
        ...currentForm,
        tags: currentForm.tags.map((tag, currentIndex) =>
          currentIndex === index ? { label: event.target.value } : tag,
        ),
      }));
    };
  }

  function addTag() {
    setForm((currentForm) => ({ ...currentForm, tags: [...currentForm.tags, { label: "" }] }));
  }

  function removeTag(index: number) {
    setForm((currentForm) => ({
      ...currentForm,
      tags: currentForm.tags.filter((_, currentIndex) => currentIndex !== index),
    }));
  }
}

function CasePreviewModal({
  form,
  publicHref,
  onPositionChange,
  onClose,
}: {
  form: CmsCasePayload;
  publicHref?: string;
  onPositionChange: (position: CmsCasePayload["screenshotPosition"]) => void;
  onClose: () => void;
}) {
  const tags = form.tags.map((tag) => tag.label.trim()).filter(Boolean);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <span>Preview do card</span>
            <h2 id="case-preview-title">{form.title || "Título do guia"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar preview">
            <X size={18} />
          </button>
        </header>

        <CaseShowcaseCard
          title={form.title || "Título do guia"}
          tags={tags.length > 0 ? tags : ["Guia"]}
          screenshot={form.screenshotUrl}
          imagePosition={form.screenshotPosition}
          href={publicHref}
        />
        <ImagePositionControl value={form.screenshotPosition} onChange={onPositionChange} />
      </section>
    </div>
  );
}

function RepeaterHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className={styles.repeaterHeader}>
      <span>{label}</span>
      <button type="button" onClick={onAdd}>
        <Plus size={16} />
        Adicionar
      </button>
    </div>
  );
}

function normalizePayload(payload: CmsCasePayload): CmsCasePayload {
  const topic = (payload.topic || payload.clientName || "").trim();
  return {
    ...payload,
    site: "falcao",
    topic,
    clientName: topic,
    seoTitle: payload.title,
    seoDescription: payload.excerpt,
    tags: payload.tags.filter((tag) => tag.label.trim()),
  };
}

function getCmsErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getCasePrimaryActionLabel(status: CmsCase["status"]) {
  if (status === "archived") {
    return "Restaurar";
  }

  return status === "published" ? "Despublicar" : "Publicar";
}

function getCaseStatusMessage(status: CmsCase["status"]) {
  if (status === "published") {
    return "Guia publicado.";
  }

  return status === "archived" ? "Guia arquivado." : "Guia em rascunho.";
}

function toForm(caseEntry: CmsCase): CmsCasePayload {
  const topic = caseEntry.topic || caseEntry.clientName || "";
  return {
    site: "falcao",
    slug: caseEntry.slug,
    title: caseEntry.title,
    excerpt: caseEntry.excerpt,
    bodyMarkdown: caseEntry.bodyMarkdown,
    seoTitle: caseEntry.seoTitle,
    seoDescription: caseEntry.seoDescription,
    topic,
    clientName: topic,
    screenshotAssetId: caseEntry.screenshotAssetId,
    screenshotUrl: caseEntry.screenshotUrl,
    screenshotPosition: caseEntry.screenshotPosition,
    tags: caseEntry.tags.length > 0 ? caseEntry.tags : [{ label: "" }],
  };
}
