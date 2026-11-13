import { ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { CampaignSourceLink } from "../../types/cms.types";
import {
  deleteCmsCampaignLink,
  listCmsCampaignLinks,
  upsertCmsCampaignLink,
} from "../../services/cmsCampaignLinks.service";
import styles from "../../pages/CmsSettingsPage/CmsSettingsPage.module.css";

const IDENTIFIER_PATTERN = "[a-z0-9][a-z0-9._-]{0,79}";
const EMPTY_DRAFT = {
  identifier: "",
  title: "",
  sourceUrl: "",
  thumbnailUrl: "",
  redirectUrl: "",
};

export function CampaignSourceLinksSettings() {
  const [links, setLinks] = useState<CampaignSourceLink[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listCmsCampaignLinks()
      .then((items) => active && setLinks(items))
      .catch(
        () =>
          active &&
          setMessage("Não foi possível carregar as origens de campanha."),
      )
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setMessage(null);
    if (!draft.identifier || !draft.title || !draft.sourceUrl) {
      setMessage("Informe identificador, título e URL de origem.");
      return;
    }
    setIsSaving(true);
    try {
      const { identifier, ...payload } = draft;
      const saved = await upsertCmsCampaignLink(identifier, payload);
      setLinks((current) =>
        [
          ...current.filter((item) => item.identifier !== saved.identifier),
          saved,
        ].sort((left, right) =>
          left.identifier.localeCompare(right.identifier),
        ),
      );
      setDraft(EMPTY_DRAFT);
      setMessage("Origem de campanha salva.");
    } catch {
      setMessage("Não foi possível salvar a origem de campanha.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(identifier: string) {
    setMessage(null);
    try {
      await deleteCmsCampaignLink(identifier);
      setLinks((current) =>
        current.filter((item) => item.identifier !== identifier),
      );
    } catch {
      setMessage("Não foi possível remover a origem de campanha.");
    }
  }

  return (
    <section className={styles.card} aria-label="Links de criativos e posts">
      <div className={styles.cardHead}>
        <h2>Links de criativos e posts (Opcional)</h2>
        <p>
          O rastreamento de todas as UTMs comuns é{" "}
          <strong>automático e ilimitado</strong>. Este cadastro é apenas
          opcional para enriquecer a <em>Jornada do Lead</em> com thumbnail e
          link direto para o Reel/post no Instagram ou YouTube correspondente ao
          identificador (<code>utm_content</code>).
        </p>
      </div>
      <div className={styles.campaignFields}>
        <input
          className={styles.input}
          value={draft.identifier}
          pattern={IDENTIFIER_PATTERN}
          placeholder="Identificador (ex: reel-custodia-01)"
          aria-label="Identificador da campanha"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              identifier: event.target.value,
            }))
          }
        />
        <input
          className={styles.input}
          value={draft.title}
          placeholder="Título do vídeo ou post (ex: Orientações em Audiência de Custódia)"
          aria-label="Título da campanha"
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
        />
        <input
          className={styles.input}
          value={draft.sourceUrl}
          type="url"
          placeholder="https://www.instagram.com/reel/... (URL do post)"
          aria-label="URL de origem"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              sourceUrl: event.target.value,
            }))
          }
        />
        <input
          className={styles.input}
          value={draft.thumbnailUrl}
          type="url"
          placeholder="https://.../thumbnail.jpg (Thumbnail opcional)"
          aria-label="URL da thumbnail"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              thumbnailUrl: event.target.value,
            }))
          }
        />
        <input
          className={styles.input}
          value={draft.redirectUrl}
          type="url"
          placeholder="https://bit.ly/... (Encurtador opcional)"
          aria-label="URL curta de redirecionamento"
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              redirectUrl: event.target.value,
            }))
          }
        />
      </div>
      <button
        type="button"
        className={styles.addButton}
        onClick={save}
        disabled={isSaving}
      >
        {isSaving ? "Salvando..." : "Salvar origem"}
      </button>
      {message ? <p className={styles.campaignMessage}>{message}</p> : null}
      {isLoading ? <p className={styles.state}>Carregando origens...</p> : null}
      {!isLoading && links.length ? (
        <div className={styles.campaignRows}>
          {links.map((link) => (
            <div key={link.identifier} className={styles.campaignRow}>
              {link.thumbnailUrl ? (
                <img
                  src={link.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <div>
                <strong>{link.title}</strong>
                <span>{link.identifier}</span>
              </div>
              <a
                href={link.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${link.title}`}
              >
                <ExternalLink size={15} />
              </a>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => remove(link.identifier)}
                aria-label={`Remover ${link.identifier}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
