import type { CSSProperties } from "react";
import { AppLink } from "@/shared/components/AppLink";
import styles from "./ArticleCard.module.css";
import type { ArticleCardProps } from "./ArticleCard.types";

export function ArticleCard({
  area,
  readingTime,
  title,
  thumbnail,
  thumbnailAlt,
  imagePosition,
  href,
  className,
}: ArticleCardProps) {
  const imageStyle = imagePosition
    ? ({
        "--image-position": `${imagePosition.x}% ${imagePosition.y}%`,
        "--image-zoom": String((imagePosition.zoom ?? 100) / 100),
      } as CSSProperties)
    : undefined;

  return (
    <article className={[styles.card, className].filter(Boolean).join(" ")}>
      <div className={styles.media}>
        {thumbnail && (
          <img src={thumbnail} alt={thumbnailAlt || title} loading="lazy" style={imageStyle} />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Área</span>
            <span className={styles.metaValue}>{area}</span>
          </span>
          <span className={styles.metaItem}>
            <span className={styles.metaLabel}>Tempo de leitura</span>
            <span className={styles.metaValue}>{readingTime}</span>
          </span>
        </div>
        <h3 className={styles.title}>{title}</h3>
        <AppLink
          className={styles.link}
          href={href}
          aria-label={`Ler artigo completo: ${title}`}
        >
          Ler artigo completo
        </AppLink>
      </div>
    </article>
  );
}
