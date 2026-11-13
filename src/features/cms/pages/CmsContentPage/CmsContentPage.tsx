import {
  Archive,
  ArchiveRestore,
  Eye,
  Pencil,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsShell } from "../../components/CmsShell";
import { useCmsContent } from "../../hooks/useCmsContent";
import {
  archiveCmsArticle,
  deleteCmsArticle,
  publishCmsArticle,
  unarchiveCmsArticle,
  unpublishCmsArticle,
} from "../../services/cmsArticle.service";
import {
  archiveCmsCase,
  deleteCmsCase,
  publishCmsCase,
  unarchiveCmsCase,
  unpublishCmsCase,
} from "../../services/cmsCase.service";
import type {
  CmsContentStatus,
  CmsContentSummary,
  CmsContentType,
  CmsSiteScope,
} from "../../types/cms.types";
import {
  getPublicArticleHref,
  getPublicCaseHref,
} from "../../utils/publicPreviewUrl";
import styles from "./CmsContentPage.module.css";

const STATUS_OPTIONS: Array<{ label: string; value: CmsContentStatus | "" }> = [
  { label: "Todos", value: "" },
  { label: "Rascunhos", value: "draft" },
  { label: "Publicados", value: "published" },
  { label: "Arquivados", value: "archived" },
];

const SITE_SCOPE: CmsSiteScope = "falcao";

const STATUS_LABELS: Record<CmsContentStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const PAGE_SIZE = 10;

export function CmsContentPage() {
  return (
    <CmsAuthGuard>
      <CmsContentView />
    </CmsAuthGuard>
  );
}

function CmsContentView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<CmsContentType>(getTypeFromPath(location.pathname));
  const [status, setStatus] = useState<CmsContentStatus | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const effectiveType: CmsContentType = activeType;
  const { items, total, isLoading, errorMessage, refetch } = useCmsContent({
    contentType: effectiveType,
    status,
    searchTerm,
    site: SITE_SCOPE,
  });
  const activeLabel = effectiveType === "article" ? "Artigos" : "Guias";
  const newContentHref =
    effectiveType === "article" ? "/cms/artigos/novo" : "/cms/guias/novo";
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, items.length);

  useEffect(() => {
    setActiveType(getTypeFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    setPage(1);
  }, [activeType, status, searchTerm]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const summary = useMemo(() => {
    const published = items.filter((item) => item.status === "published").length;
    const drafts = items.filter((item) => item.status === "draft").length;
    const archived = items.filter((item) => item.status === "archived").length;
    return { published, drafts, archived };
  }, [items]);

  function handleTypeChange(contentType: CmsContentType) {
    setActiveType(contentType);
    navigate(contentType === "article" ? "/cms/artigos" : "/cms/guias");
  }

  return (
    <CmsShell
      title="Conteúdo"
      crumb="Conteúdo"
      searchPlaceholder="Buscar título ou slug"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      primaryAction={{ label: `Novo ${effectiveType === "article" ? "artigo" : "guia"}`, href: newContentHref }}
    >
    <main className={styles.page}>
      <section className={styles.stats} aria-label="Resumo">
        <div>
          <i style={{ background: "var(--ink)" }} />
          <div><strong>{total}</strong><span>Total</span></div>
        </div>
        <div>
          <i style={{ background: "var(--ok)" }} />
          <div><strong>{summary.published}</strong><span>Publicados</span></div>
        </div>
        <div>
          <i style={{ background: "var(--blue)" }} />
          <div><strong>{summary.drafts}</strong><span>Rascunhos</span></div>
        </div>
        <div>
          <i style={{ background: "var(--ink-3)" }} />
          <div><strong>{summary.archived}</strong><span>Arquivados</span></div>
        </div>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.pills} role="tablist" aria-label="Tipo de conteúdo">
          <button type="button" role="tab" className={styles.pill} data-active={activeType === "article"} onClick={() => handleTypeChange("article")}>Artigos</button>
          <button type="button" role="tab" className={styles.pill} data-active={activeType === "case"} onClick={() => handleTypeChange("case")}>Guias</button>
        </div>
        <span className={styles.divider} />
        <div className={styles.pills} aria-label="Filtrar por status">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={styles.pill}
              data-weight="600"
              data-active={(status ?? "") === option.value}
              onClick={() => setStatus(toStatus(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className={styles.range}>{rangeStart}-{rangeEnd} de {items.length}</span>
      </section>

      <section className={styles.tableShell} aria-label={`Lista de ${activeLabel}`}>
        {isLoading ? (
          <p className={styles.state}>Carregando...</p>
        ) : errorMessage ? (
          <p className={styles.state}>{errorMessage}</p>
        ) : items.length === 0 ? (
          <p className={styles.state}>Nenhum conteudo encontrado.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>{effectiveType === "article" ? "Area" : "Frente"}</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => (
                <ContentRow key={item.id} item={item} onMutated={refetch} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isLoading && !errorMessage && items.length > 0 ? (
        <section className={styles.pagination} aria-label="Paginacao">
          <span>
            {rangeStart}-{rangeEnd} de {items.length}
          </span>
          <div className={styles.pageControls}>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>
              Pagina {page} de {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page >= pageCount}
            >
              Proxima
            </button>
          </div>
        </section>
      ) : null}
    </main>
    </CmsShell>
  );
}

function ContentRow({ item, onMutated }: { item: CmsContentSummary; onMutated: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const publicHref =
    item.contentType === "article"
      ? getPublicArticleHref(item.site, item.slug)
      : getPublicCaseHref(item.site, item.slug);
  const editHref =
    item.contentType === "article" ? `/cms/artigos/${item.id}` : `/cms/guias/${item.id}`;
  const canViewPublic = item.status === "published";
  const isPublished = item.status === "published";
  const isArchived = item.status === "archived";
  const publishLabel = isPublished ? "Despublicar" : "Publicar";
  const archiveLabel = isArchived ? "Restaurar" : "Arquivar";

  async function runAction(action: () => Promise<unknown>) {
    if (isPending) {
      return;
    }

    setIsPending(true);
    try {
      await action();
      onMutated();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Acao nao concluida.";
      window.alert(message);
    } finally {
      setIsPending(false);
    }
  }

  function handlePublishToggle() {
    if (item.contentType === "article") {
      void runAction(() =>
        isPublished ? unpublishCmsArticle(item.id) : publishCmsArticle(item.id),
      );
    } else {
      void runAction(() => (isPublished ? unpublishCmsCase(item.id) : publishCmsCase(item.id)));
    }
  }

  function handleArchive() {
    void runAction(() =>
      item.contentType === "article" ? archiveCmsArticle(item.id) : archiveCmsCase(item.id),
    );
  }

  function handleArchiveToggle() {
    if (isArchived) {
      void runAction(() =>
        item.contentType === "article"
          ? unarchiveCmsArticle(item.id)
          : unarchiveCmsCase(item.id),
      );
      return;
    }

    handleArchive();
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${item.title}"? Esta acao nao pode ser desfeita.`,
    );
    if (!confirmed) {
      return;
    }

    void runAction(() =>
      item.contentType === "article" ? deleteCmsArticle(item.id) : deleteCmsCase(item.id),
    );
  }

  return (
    <tr>
      <td>
        <strong>{item.title}</strong>
        <span>{item.slug}</span>
      </td>
      <td>{item.detailLabel || "-"}</td>
      <td>
        <span className={[styles.badge, styles[item.status]].join(" ")}>
          {STATUS_LABELS[item.status]}
        </span>
      </td>
      <td>{formatDate(item.updatedAt)}</td>
      <td>
        <div className={styles.actions}>
          <a href={editHref} aria-label={`Editar ${item.title}`}>
            <Pencil size={16} />
          </a>
          <a
            href={canViewPublic ? publicHref : "#"}
            aria-disabled={!canViewPublic}
            aria-label={`Visualizar ${item.title}`}
          >
            <Eye size={16} />
          </a>
          <button
            type="button"
            onClick={handlePublishToggle}
            disabled={isPending || isArchived}
            aria-label={publishLabel}
            title={isArchived ? "Restaure para publicar" : publishLabel}
          >
            {isPublished ? <Undo2 size={16} /> : <Send size={16} />}
          </button>
          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={isPending}
            aria-label={`${archiveLabel} ${item.title}`}
            title={archiveLabel}
          >
            {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Excluir ${item.title}`}
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function getTypeFromPath(pathname: string): CmsContentType {
  return pathname.includes("/guias") || pathname.includes("/cases") ? "case" : "article";
}

function toStatus(value: string): CmsContentStatus | undefined {
  return value ? (value as CmsContentStatus) : undefined;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
