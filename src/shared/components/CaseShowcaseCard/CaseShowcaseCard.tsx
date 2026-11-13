import type { CSSProperties } from "react";
import { AppLink } from "@/shared/components/AppLink";
import styles from "./CaseShowcaseCard.module.css";
import type { CaseShowcaseCardProps } from "./CaseShowcaseCard.types";
import { useAutoFitCardContent } from "./useAutoFitCardContent";

export function CaseShowcaseCard({
  title,
  tags,
  metrics = [],
  screenshot,
  screenshotAlt,
  imagePosition,
  href,
  className,
}: CaseShowcaseCardProps) {
  const cardClassName = [styles.card, className].filter(Boolean).join(" ");
  const imageStyle = imagePosition
    ? ({
        "--image-position": `${imagePosition.x}% ${imagePosition.y}%`,
        "--image-zoom": String((imagePosition.zoom ?? 100) / 100),
      } as CSSProperties)
    : undefined;

  // Refaz o auto-fit sempre que título ou métricas mudam
  const contentSignature = [
    title,
    ...metrics.map((m) => `${m.prefix ?? ""}${m.value}${m.label}`),
  ].join("|");
  const { containerRef, metricsRef } = useAutoFitCardContent(contentSignature);

  return (
    <article className={cardClassName} ref={containerRef}>
      <div className={styles.cardBody}>
        <div className={styles.cardIntro}>
          <div className={styles.cardTags}>
            {tags.map((tag) => (
              <span key={tag} className={styles.cardTag}>
                {tag}
              </span>
            ))}
          </div>
          <h3 className={styles.cardTitle} data-card-title>
            {title}
          </h3>
        </div>

        {metrics.length > 0 ? (
          <div className={styles.metrics} ref={metricsRef}>
            {metrics.map((metric) => (
              <div
                key={`${metric.prefix ?? ""}-${metric.value}-${metric.label}`}
                className={styles.metric}
                data-metric
              >
                <span className={styles.metricValue}>
                  {metric.prefix && <span className={styles.metricPrefix}>{metric.prefix}</span>}
                  {metric.value}
                </span>
                <span className={styles.metricLabel} data-metric-label>
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {href && (
          <AppLink
            className={styles.link}
            href={href}
            data-track={`Card · ${title}`}
            aria-label={`Ler guia completo: ${title}`}
          >
            Ler guia completo
          </AppLink>
        )}
      </div>

      <div className={styles.cardMedia}>
        {screenshot ? (
          <img src={screenshot} alt={screenshotAlt || title} loading="lazy" style={imageStyle} />
        ) : (
          <div className={styles.cardMediaFallback} aria-hidden />
        )}
      </div>
    </article>
  );
}
