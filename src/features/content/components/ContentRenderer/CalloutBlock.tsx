import React from "react";
import styles from "./ContentRenderer.module.css";

export type CalloutType = "tip" | "warning";

interface CalloutBlockProps extends React.ComponentPropsWithoutRef<"blockquote"> {
  children?: React.ReactNode;
}

function extractAllText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractAllText).join("");
  if (React.isValidElement(node) && node.props && "children" in (node.props as Record<string, unknown>)) {
    return extractAllText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function detectCalloutType(text: string): { type: CalloutType; title: string } | null {
  const trimmed = text.trim();
  if (
    trimmed.startsWith("[!TIP]") ||
    trimmed.startsWith("[!NOTE]") ||
    /^(\*\*)?dica:?/i.test(trimmed)
  ) {
    return { type: "tip", title: "Dica" };
  }
  if (
    trimmed.startsWith("[!WARNING]") ||
    trimmed.startsWith("[!CAUTION]") ||
    trimmed.startsWith("[!IMPORTANT]") ||
    /^(\*\*)?(atenção|atencao|cuidado):?/i.test(trimmed)
  ) {
    return { type: "warning", title: "Atenção" };
  }
  return null;
}

function stripMarker(text: string): string {
  return text
    .replace(/^\[!(TIP|NOTE|WARNING|CAUTION|IMPORTANT)\]\s*/i, "")
    .replace(/^(\*\*)?(dica|atenção|atencao|cuidado):?(\*\*)?\s*/i, "");
}

function cleanChildNodes(children: React.ReactNode): React.ReactNode {
  const childArray = React.Children.toArray(children);
  if (childArray.length === 0) return children;

  const first = childArray[0];
  if (!React.isValidElement(first)) {
    if (typeof first === "string") {
      const cleaned = stripMarker(first);
      return [cleaned, ...childArray.slice(1)];
    }
    return children;
  }

  const firstProps = first.props as { children?: React.ReactNode };
  if (firstProps && "children" in firstProps) {
    const pChildren = React.Children.toArray(firstProps.children);
    if (pChildren.length > 0) {
      let cleanedPChildren = [...pChildren];
      const pFirst = cleanedPChildren[0];

      if (
        React.isValidElement(pFirst) &&
        /^(\*\*)?(dica|atenção|atencao|cuidado):?/i.test(extractAllText(pFirst).trim())
      ) {
        cleanedPChildren = cleanedPChildren.slice(1);
      } else if (typeof pFirst === "string") {
        cleanedPChildren[0] = stripMarker(pFirst);
      }

      if (typeof cleanedPChildren[0] === "string") {
        cleanedPChildren[0] = cleanedPChildren[0].replace(/^[\s:\-]+/, "");
      }

      const updatedFirst = React.cloneElement(first, {}, ...cleanedPChildren);
      return [updatedFirst, ...childArray.slice(1)];
    }
  }

  return children;
}

export function CalloutBlock({ children, className, ...props }: CalloutBlockProps) {
  const fullText = extractAllText(children);
  const detected = detectCalloutType(fullText);

  if (!detected) {
    return (
      <blockquote className={className} {...props}>
        {children}
      </blockquote>
    );
  }

  const { type, title } = detected;
  const isTip = type === "tip";
  const cleanedChildren = cleanChildNodes(children);

  return (
    <aside
      className={`${styles.callout} ${isTip ? styles.calloutTip : styles.calloutWarning} ${className ?? ""}`}
      role={isTip ? "note" : "alert"}
      aria-label={title}
    >
      <div className={styles.calloutHeader}>
        {isTip ? (
          <svg
            className={styles.calloutIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
        ) : (
          <svg
            className={styles.calloutIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        <span className={styles.calloutTitle}>{title}</span>
      </div>
      <div className={styles.calloutBody}>{cleanedChildren}</div>
    </aside>
  );
}
