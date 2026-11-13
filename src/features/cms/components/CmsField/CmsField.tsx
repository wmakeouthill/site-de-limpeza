import type { ReactNode } from "react";
import styles from "./CmsField.module.css";

export interface CmsFieldProps {
  label: string;
  hint?: string;
  tooltip?: string;
  children: ReactNode;
  as?: "label" | "div";
}

export function CmsField({
  label,
  hint,
  tooltip,
  children,
  as = "label",
}: CmsFieldProps) {
  const content = (
    <>
      <span className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        {tooltip ? (
          <span className={styles.tooltipWrap}>
            <button
              type="button"
              className={styles.tooltipButton}
              aria-label={`Ajuda: ${label}`}
            >
              i
            </button>
            <span className={styles.tooltip} role="tooltip">
              {tooltip}
            </span>
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </>
  );

  if (as === "div") {
    return <div className={styles.field}>{content}</div>;
  }

  return <label className={styles.field}>{content}</label>;
}
