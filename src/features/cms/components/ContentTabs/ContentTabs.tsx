import type { CmsContentType } from "../../types/cms.types";
import styles from "./ContentTabs.module.css";

interface ContentTabsProps {
  activeType: CmsContentType;
  onChange: (contentType: CmsContentType) => void;
}

const TABS: Array<{ label: string; value: CmsContentType }> = [
  { label: "Artigos", value: "article" },
  { label: "Guias", value: "case" },
];

export function ContentTabs({ activeType, onChange }: ContentTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Tipo de conteudo">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={activeType === tab.value}
          className={activeType === tab.value ? styles.active : undefined}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
