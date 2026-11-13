import { ArchiveRestore, Eye, Save, Send, X } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArticleCard } from "@/shared/components/ArticleCard";
import { CmsField } from "../../components/CmsField";
import { CmsAuthGuard } from "../../components/CmsAuthGuard";
import { CmsShell } from "../../components/CmsShell";
import { ImagePositionControl } from "../../components/ImagePositionControl";
import { ImageUploadField } from "../../components/ImageUploadField";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { useCmsAuth } from "../../context/CmsAuthContext";
import {
  createCmsArticle,
  getCmsArticle,
  publishCmsArticle,
  unarchiveCmsArticle,
  unpublishCmsArticle,
  updateCmsArticle,
} from "../../services/cmsArticle.service";
import { listCmsAuthors } from "../../services/cmsAuthors.service";
import type { CmsArticle, CmsArticlePayload, CmsAuthor } from "../../types/cms.types";
import { getPublicArticleHref } from "../../utils/publicPreviewUrl";
import styles from "./ArticleEditorPage.module.css";

const MANUAL_AUTHOR_VALUE = "__manual__";

const EMPTY_ARTICLE: CmsArticlePayload = {
  site: "falcao",
  slug: "",
  title: "",
  excerpt: "",
  bodyMarkdown: "",
  seoTitle: "",
  seoDescription: "",
  area: "Dicas",
  categoria: "dicas",
  readingTime: "",
  thumbnailAssetId: null,
  thumbnailUrl: "",
  thumbnailPosition: { x: 50, y: 50, zoom: 100 },
  authorName: "",
  authorEmail: null,
  authorImageUrl: "",
};

type CmsArticleTextField = Exclude<
  keyof CmsArticlePayload,
  "thumbnailAssetId" | "thumbnailPosition" | "authorEmail" | "authorImageUrl" | "site"
>;

export function ArticleEditorPage() {
  return (
    <CmsAuthGuard>
      <CmsShell>
        <ArticleEditorView />
      </CmsShell>
    </CmsAuthGuard>
  );
}

function ArticleEditorView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useCmsAuth();
  const isNewArticle = !id || id === "novo";
  const [articleId, setArticleId] = useState<string | null>(isNewArticle ? null : id);
  const [status, setStatus] = useState<CmsArticle["status"]>("draft");
  const [form, setForm] = useState<CmsArticlePayload>(() => ({
    ...EMPTY_ARTICLE,
    site: "falcao",
    authorName: session.name || session.email,
    authorEmail: session.email,
    authorImageUrl: session.photoUrl ?? "",
  }));
  const [authors, setAuthors] = useState<CmsAuthor[]>([]);
  const [authorsLoaded, setAuthorsLoaded] = useState(false);
  const [authorSelect, setAuthorSelect] = useState(session.email || MANUAL_AUTHOR_VALUE);
  const [isLoading, setIsLoading] = useState(!isNewArticle);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false);

  const authorOptions = useMemo(() => {
    const items = [...authors];
    if (
      session.email &&
      !items.some((author) => author.email.toLowerCase() === session.email.toLowerCase())
    ) {
      items.unshift({
        email: session.email,
        name: session.name || session.email,
        photoUrl: session.photoUrl ?? "",
      });
    }
    return items;
  }, [authors, session.email, session.name, session.photoUrl]);

  useEffect(() => {
    let isMounted = true;
    listCmsAuthors()
      .then((items) => {
        if (isMounted) {
          setAuthors(items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAuthors([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setAuthorsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isNewArticle || !id) {
      return;
    }

    let isMounted = true;
    getCmsArticle(id)
      .then((article) => {
        if (!isMounted) {
          return;
        }
        setArticleId(article.id);
        setStatus(article.status);
        setForm(toForm(article));
        setAuthorSelect(resolveAuthorSelect(article, session.email));
      })
      .catch(() => {
        if (isMounted) {
          setMessage("Nao foi possivel carregar o artigo.");
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
  }, [id, isNewArticle, session.email]);

  useEffect(() => {
    if (authorSelect === MANUAL_AUTHOR_VALUE || !authorSelect) {
      return;
    }

    const matched = authorOptions.find(
      (author) => author.email.toLowerCase() === authorSelect.toLowerCase(),
    );
    if (!matched) {
      if (authorsLoaded) {
        setAuthorSelect(MANUAL_AUTHOR_VALUE);
      }
      return;
    }

    setForm((current) => {
      if (
        current.authorEmail?.toLowerCase() === matched.email.toLowerCase() &&
        current.authorName === matched.name &&
        current.authorImageUrl === (matched.photoUrl || "")
      ) {
        return current;
      }

      return {
        ...current,
        authorName: matched.name,
        authorEmail: matched.email,
        authorImageUrl: matched.photoUrl || "",
      };
    });
  }, [authorOptions, authorSelect, authorsLoaded]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.authorName.trim()) {
      setMessage("Informe o autor do artigo.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const savedArticle = articleId
        ? await updateCmsArticle(articleId, form)
        : await createCmsArticle(form);
      setArticleId(savedArticle.id);
      setStatus(savedArticle.status);
      setMessage("Rascunho salvo.");
      if (!articleId) {
        navigate(`/cms/artigos/${savedArticle.id}`, { replace: true });
      }
    } catch (error) {
      setMessage(getCmsErrorMessage(error, "Nao foi possivel salvar o artigo."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublicationToggle() {
    if (!articleId) {
      return;
    }

    if (status !== "published" && status !== "archived" && !form.authorName.trim()) {
      setMessage("Informe o autor do artigo antes de publicar.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      // Salva metadados (incl. autor) antes de publicar, para nao usar estado antigo.
      if (status !== "published" && status !== "archived") {
        const savedArticle = await updateCmsArticle(articleId, form);
        setStatus(savedArticle.status);
      }

      const updatedArticle =
        status === "archived"
          ? await unarchiveCmsArticle(articleId)
          : status === "published"
            ? await unpublishCmsArticle(articleId)
            : await publishCmsArticle(articleId);
      setStatus(updatedArticle.status);
      setMessage(getArticleStatusMessage(updatedArticle.status));
    } catch (error) {
      setMessage(getCmsErrorMessage(error, "Nao foi possivel alterar a publicacao."));
    } finally {
      setIsSaving(false);
    }
  }

  function handleAuthorSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setAuthorSelect(value);

    if (value === MANUAL_AUTHOR_VALUE) {
      setForm((current) => ({
        ...current,
        authorEmail: null,
        authorImageUrl: "",
      }));
      return;
    }

    const matched = authorOptions.find((author) => author.email === value);
    if (!matched) {
      return;
    }

    setForm((current) => ({
      ...current,
      authorName: matched.name,
      authorEmail: matched.email,
      authorImageUrl: matched.photoUrl || "",
    }));
  }

  if (isLoading) {
    return <main className={styles.page}>Carregando...</main>;
  }

  const previewHref = form.slug ? getPublicArticleHref(form.site, form.slug) : "#";

  return (
    <main className={styles.page}>
      <form className={styles.editor} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <div>
            <span>Artigo</span>
            <h1>{isNewArticle ? "Novo artigo" : form.title || "Editar artigo"}</h1>
          </div>
          <div className={styles.actions}>
            {articleId && (
              <a href={previewHref} target="_blank" rel="noreferrer">
                <Eye size={18} />
                Preview
              </a>
            )}
            {articleId && (
              <button type="button" onClick={handlePublicationToggle} disabled={isSaving}>
                {status === "archived" ? <ArchiveRestore size={18} /> : <Send size={18} />}
                {getArticlePrimaryActionLabel(status)}
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
              <p>Titulo, slug e metadados basicos do artigo.</p>
            </header>
            <div className={styles.fields}>
              <CmsField label="Titulo" hint="Nome que aparece no card e na pagina">
                <input value={form.title} onChange={handleChange("title")} required />
              </CmsField>
              <CmsField
                label="Slug"
                hint="exemplo-do-artigo"
                tooltip="Use apenas minusculas, numeros e hifens."
              >
                <input value={form.slug} onChange={handleChange("slug")} required />
              </CmsField>
              <div className={styles.twoColumns}>
                <CmsField label="Categoria">
                  <select
                    value={form.categoria || "dicas"}
                    onChange={(e) => setForm((curr) => ({ ...curr, categoria: e.target.value, area: e.target.value === "testamos" ? "A gente testou" : e.target.value === "empresas" ? "Empresas" : "Dicas" }))}
                    data-testid="article-categoria-select"
                  >
                    <option value="dicas">Dicas</option>
                    <option value="empresas">Empresas</option>
                    <option value="testamos">A gente testou (Com selo)</option>
                    <option value="geral">Geral</option>
                  </select>
                </CmsField>
                <CmsField label="Tempo de leitura">
                  <input
                    value={form.readingTime}
                    onChange={handleChange("readingTime")}
                    placeholder="5 min"
                    required
                  />
                </CmsField>
              </div>

              {form.categoria === "testamos" && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#f0f7ff",
                    border: "1px solid #003399",
                    borderRadius: "8px",
                    color: "#003399",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}
                  data-testid="editorial-notice-testamos"
                >
                  <strong>Aviso Editorial:</strong> Ao marcar a categoria &quot;A gente testou&quot;, o artigo deve conter avalia&ccedil;&atilde;o pr&aacute;tica e honesta realizada pela equipe da Falc&atilde;o Limpeza na loja.
                </div>
              )}
              <CmsField
                label="Resumo"
                hint="Subtitulo do card; tambem vira a descricao do Google"
              >
                <textarea value={form.excerpt} rows={3} onChange={handleChange("excerpt")} />
              </CmsField>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Card de destaque</h2>
              <p>Imagem usada na lista e no card de destaque.</p>
            </header>
            <div className={styles.fields}>
              <div className={styles.imageField}>
                <ImageUploadField
                  label="Imagem do card"
                  value={form.thumbnailUrl}
                  onChange={(url, assetId) =>
                    setForm((current) => ({
                      ...current,
                      thumbnailUrl: url,
                      thumbnailAssetId: assetId,
                    }))
                  }
                  placeholder="/assets/article-1.png"
                />
                <span className={styles.fieldHint}>
                  Aparece na lista; na leitura e a mesma imagem, sem o recorte do card
                </span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2>Autor</h2>
              <p>Quem assina o artigo na pagina publica.</p>
            </header>
            <div className={styles.fields}>
              <CmsField
                label="Autor"
                hint="Quem assina o artigo na pagina publica"
                as="div"
              >
                <select
                  value={authorSelect}
                  onChange={handleAuthorSelectChange}
                  required={authorSelect !== MANUAL_AUTHOR_VALUE}
                >
                  {authorOptions.map((author) => (
                    <option key={author.email} value={author.email}>
                      {author.name} ({author.email})
                    </option>
                  ))}
                  <option value={MANUAL_AUTHOR_VALUE}>Outro…</option>
                </select>
                {authorSelect === MANUAL_AUTHOR_VALUE ? (
                  <input
                    className={styles.manualAuthorInput}
                    value={form.authorName}
                    onChange={handleChange("authorName")}
                    placeholder="Nome do autor"
                    required
                  />
                ) : null}
              </CmsField>
            </div>
          </section>
        </div>

        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2>Conteudo</h2>
            <p>Corpo do artigo em Markdown.</p>
          </header>
          <div className={styles.contentField}>
            <CmsField label="Conteudo" as="div">
              <MarkdownEditor
                value={form.bodyMarkdown}
                onChange={(markdown) =>
                  setForm((current) => ({ ...current, bodyMarkdown: markdown }))
                }
              />
            </CmsField>
          </div>
        </section>
      </form>

      {isCardPreviewOpen && (
        <ArticlePreviewModal
          form={form}
          onPositionChange={(thumbnailPosition) =>
            setForm((currentForm) => ({ ...currentForm, thumbnailPosition }))
          }
          onClose={() => setIsCardPreviewOpen(false)}
        />
      )}
    </main>
  );

  function handleChange(field: CmsArticleTextField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((currentForm) => ({ ...currentForm, [field]: event.target.value }));
    };
  }
}

function ArticlePreviewModal({
  form,
  onPositionChange,
  onClose,
}: {
  form: CmsArticlePayload;
  onPositionChange: (position: CmsArticlePayload["thumbnailPosition"]) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const previewHref = form.slug ? getPublicArticleHref(form.site, form.slug) : "#";

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="article-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <div>
            <span>Preview do card</span>
            <h2 id="article-preview-title">{form.title || "Titulo do artigo"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar preview">
            <X size={18} />
          </button>
        </header>

        <ArticleCard
          className={styles.previewCard}
          area={form.area || "Area"}
          readingTime={form.readingTime || "6 min"}
          title={form.title || "Titulo do artigo"}
          thumbnail={form.thumbnailUrl}
          imagePosition={form.thumbnailPosition}
          href={previewHref}
        />
        <ImagePositionControl value={form.thumbnailPosition} onChange={onPositionChange} />
      </section>
    </div>
  );
}

function getCmsErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getArticlePrimaryActionLabel(status: CmsArticle["status"]) {
  if (status === "archived") {
    return "Restaurar";
  }

  return status === "published" ? "Despublicar" : "Publicar";
}

function getArticleStatusMessage(status: CmsArticle["status"]) {
  if (status === "published") {
    return "Artigo publicado.";
  }

  return status === "archived" ? "Artigo arquivado." : "Artigo em rascunho.";
}

function resolveAuthorSelect(article: CmsArticle, sessionEmail: string): string {
  if (article.authorEmail) {
    return article.authorEmail;
  }

  if (article.authorName) {
    return MANUAL_AUTHOR_VALUE;
  }

  return sessionEmail || MANUAL_AUTHOR_VALUE;
}

function toForm(article: CmsArticle): CmsArticlePayload {
  return {
    site: article.site,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    bodyMarkdown: article.bodyMarkdown,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    area: article.area || "Dicas",
    categoria: article.categoria || "dicas",
    readingTime: article.readingTime,
    thumbnailAssetId: article.thumbnailAssetId,
    thumbnailUrl: article.thumbnailUrl,
    thumbnailPosition: article.thumbnailPosition,
    authorName: article.authorName,
    authorEmail: article.authorEmail,
    authorImageUrl: article.authorImageUrl,
  };
}
