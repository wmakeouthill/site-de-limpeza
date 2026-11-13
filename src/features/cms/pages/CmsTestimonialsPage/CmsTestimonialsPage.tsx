import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsField } from "../../components/CmsField";
import { CmsShell } from "../../components/CmsShell";
import { testimonialsKey } from "../../hooks/cmsQueryKeys";
import { useCmsCachedQuery } from "../../hooks/useCmsCachedQuery";
import {
  createCmsTestimonial,
  deleteCmsTestimonial,
  listCmsTestimonials,
  reorderCmsTestimonials,
  updateCmsTestimonial,
  type CmsTestimonialInput,
} from "../../services/cmsTestimonials.service";
import type { CmsTestimonial } from "../../types/cms.types";
import styles from "./CmsTestimonialsPage.module.css";

const EMPTY_FORM: CmsTestimonialInput = {
  site: "falcao",
  author: "",
  role: "",
  company: "",
  quote: "",
  youtubeId: "",
  avatarUrl: "",
  isActive: true,
};

export function CmsTestimonialsPage() {
  return (
    <CmsAuthGuard>
      <CmsTestimonialsView />
    </CmsAuthGuard>
  );
}

function CmsTestimonialsView() {
  const site = "falcao";
  const [editing, setEditing] = useState<CmsTestimonial | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isFetching, errorMessage, refetch } = useCmsCachedQuery<CmsTestimonial[]>(
    testimonialsKey(site),
    () => listCmsTestimonials(site),
    [],
    "Nao foi possivel carregar os depoimentos.",
    { keepPreviousData: true },
  );

  const isDialogOpen = isCreating || editing !== null;

  function closeDialog() {
    setIsCreating(false);
    setEditing(null);
  }

  async function handleSave(payload: CmsTestimonialInput) {
    if (editing) {
      await updateCmsTestimonial(editing.id, payload);
    } else {
      await createCmsTestimonial(payload);
    }
    closeDialog();
    refetch();
  }

  function handleDelete(item: CmsTestimonial) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o depoimento de "${item.author}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) {
      return;
    }

    setActionError(null);
    void deleteCmsTestimonial(item.id)
      .then(refetch)
      .catch((error: unknown) =>
        setActionError(
          error instanceof Error ? error.message : "Não foi possível excluir o depoimento.",
        ),
      );
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (isReordering || target < 0 || target >= data.length) {
      return;
    }

    const next = [...data];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setActionError(null);
    setIsReordering(true);
    try {
      await reorderCmsTestimonials(
        site,
        next.map((item) => item.id),
      );
      refetch();
    } catch (error: unknown) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível reordenar os depoimentos.",
      );
    } finally {
      setIsReordering(false);
    }
  }

  return (
    <CmsShell title="Depoimentos" crumb="Depoimentos">
      <main className={styles.page}>
        <div className={styles.toolbar}>
          <button type="button" className={styles.newButton} onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            Novo depoimento
          </button>
        </div>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        {actionError ? <p className={styles.error}>{actionError}</p> : null}

        <section className={styles.tableShell} aria-label="Lista de depoimentos">
          {isFetching && data.length === 0 ? (
            <p className={styles.state}>Carregando...</p>
          ) : data.length === 0 ? (
            <p className={styles.state}>Nenhum depoimento cadastrado.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Depoimento</th>
                  <th>Empresa/Cargo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.authorCell}>
                        <div>
                          <strong>{item.author}</strong>
                          <span>{truncate(item.quote, 90)}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.company || item.role || "-"}</td>
                    <td>
                      <span
                        className={[
                          styles.badge,
                          item.isActive ? styles.active : styles.inactive,
                        ].join(" ")}
                      >
                        {item.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {index > 0 ? (
                          <button
                            type="button"
                            onClick={() => void move(index, -1)}
                            disabled={isReordering}
                            aria-label="Mover para cima"
                            title="Mover para cima"
                          >
                            <ArrowUp size={16} />
                          </button>
                        ) : null}
                        {index < data.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => void move(index, 1)}
                            disabled={isReordering}
                            aria-label="Mover para baixo"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={16} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          aria-label={`Editar depoimento de ${item.author}`}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.danger}
                          onClick={() => handleDelete(item)}
                          aria-label={`Excluir depoimento de ${item.author}`}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {isDialogOpen ? (
        <TestimonialDialog testimonial={editing} onClose={closeDialog} onSave={handleSave} />
      ) : null}
    </CmsShell>
  );
}

interface TestimonialDialogProps {
  testimonial: CmsTestimonial | null;
  onClose: () => void;
  onSave: (payload: CmsTestimonialInput) => Promise<void>;
}

function TestimonialDialog({
  testimonial,
  onClose,
  onSave,
}: Readonly<TestimonialDialogProps>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<CmsTestimonialInput>(() =>
    testimonial
      ? {
          site: "falcao",
          author: testimonial.author,
          role: testimonial.role,
          company: testimonial.company,
          quote: testimonial.quote,
          youtubeId: "",
          avatarUrl: "",
          isActive: testimonial.isActive,
        }
      : { ...EMPTY_FORM, site: "falcao" },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function updateField<K extends keyof CmsTestimonialInput>(key: K, value: CmsTestimonialInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível salvar o depoimento.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={testimonial ? "Editar depoimento" : "Novo depoimento"}
      onClose={onClose}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom;
        if (outside) onClose();
      }}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <header className={styles.dialogHeader}>
          <h2>{testimonial ? "Editar depoimento" : "Novo depoimento"}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className={styles.dialogBody}>
          <CmsField label="Autor">
            <input
              value={form.author}
              onChange={(event) => updateField("author", event.target.value)}
              placeholder="Ex: Dr. Marcelo Ribeiro"
              required
            />
          </CmsField>

          <CmsField label="Cargo">
            <input
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              placeholder="Ex: Cliente"
            />
          </CmsField>

          <CmsField label="Empresa">
            <input
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
              placeholder="Ex: Grupo Empresarial"
            />
          </CmsField>

          <CmsField label="Depoimento">
            <textarea
              value={form.quote}
              onChange={(event) => updateField("quote", event.target.value)}
              rows={5}
              placeholder="Relato ou considerações sobre o trabalho prestado..."
              required
            />
          </CmsField>

          <label className={styles.toggleRow}>
            <span>Ativo</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateField("isActive", event.target.checked)}
            />
          </label>
        </div>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        <div className={styles.dialogActions}>
          <button type="button" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveButton} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
