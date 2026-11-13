import { useCallback, useEffect, useState } from "react";
import { Check, Heart, Share2 } from "lucide-react";

interface ArticleActionsProps {
  readonly slug: string;
}

export function ArticleActions({ slug }: ArticleActionsProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLikes() {
      try {
        const res = await fetch(`/api/public/articles/${encodeURIComponent(slug)}/likes`);
        if (res.ok) {
          const data = (await res.json()) as { liked: boolean; likes_count: number };
          if (active) {
            setLiked(Boolean(data.liked));
            setLikesCount(data.likes_count ?? 0);
          }
        }
      } catch (_err) {
        // Falha de leitura de likes não impede navegação
      }
    }
    void loadLikes();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleToggleLike = useCallback(async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const res = await fetch(`/api/public/articles/${encodeURIComponent(slug)}/likes/toggle`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likes_count: number };
        setLiked(Boolean(data.liked));
        setLikesCount(data.likes_count ?? 0);
      }
    } catch (_err) {
      // Ignora erro de rede no toggle
    } finally {
      setIsToggling(false);
    }
  }, [slug, isToggling]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url,
        });
        return;
      } catch (_err) {
        // Usuário cancelou ou navegador recusou share sheet
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (_err) {
        // Clipboard indisponível
      }
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "16px 0",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        margin: "32px 0",
      }}
    >
      <button
        type="button"
        onClick={handleToggleLike}
        disabled={isToggling}
        aria-label={liked ? "Remover curtida deste artigo" : "Curtir este artigo"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: liked ? "var(--brand-soft)" : "transparent",
          color: liked ? "var(--brand-strong)" : "var(--ink-2)",
          border: "1px solid var(--line)",
          padding: "8px 16px",
          borderRadius: "999px",
          fontFamily: "inherit",
          fontSize: "14px",
          cursor: isToggling ? "wait" : "pointer",
          transition: "all .2s ease",
        }}
      >
        <Heart
          size={16}
          style={{
            fill: liked ? "var(--brand)" : "none",
            stroke: liked ? "var(--brand)" : "currentColor",
          }}
        />
        <span>{liked ? "Curtido" : "Curtir"}</span>
        {likesCount !== null && (
          <span
            style={{
              padding: "2px 6px",
              background: "var(--surface-2)",
              borderRadius: "10px",
              fontSize: "12px",
            }}
          >
            {likesCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={handleShare}
        aria-label="Compartilhar este artigo"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "transparent",
          color: "var(--ink-2)",
          border: "1px solid var(--line)",
          padding: "8px 16px",
          borderRadius: "999px",
          fontFamily: "inherit",
          fontSize: "14px",
          cursor: "pointer",
          transition: "all .2s ease",
        }}
      >
        {copied ? (
          <>
            <Check size={16} style={{ stroke: "var(--brand)" }} />
            <span style={{ color: "var(--brand)" }}>Link copiado!</span>
          </>
        ) : (
          <>
            <Share2 size={16} />
            <span>Compartilhar</span>
          </>
        )}
      </button>
    </div>
  );
}
