import { ContentRenderer } from "@/features/content/components/ContentRenderer";
import styles from "./EditorialContent.module.css";

interface EditorialContentProps {
  readonly content: string;
  readonly className?: string;
}

export function EditorialContent({ content, className }: EditorialContentProps) {
  const containerClass = [styles.editorialWrapper, className].filter(Boolean).join(" ");

  return (
    <div className={containerClass}>
      <ContentRenderer markdown={content} />
    </div>
  );
}
