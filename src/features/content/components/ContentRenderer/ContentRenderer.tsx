import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { CalloutBlock } from "./CalloutBlock";
import { CodeBlock } from "./CodeBlock";
import { MermaidDiagram } from "./MermaidDiagram";
import { TableBlock } from "./TableBlock";
import styles from "./ContentRenderer.module.css";

type HastNode = {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

interface ContentRendererProps {
  readonly markdown: string;
  readonly className?: string;
}

export function ContentRenderer({ markdown, className }: ContentRendererProps) {
  const normalizedMarkdown = normalizeFloatingFigures(markdown);

  return (
    <div className={[styles.content, className].filter(Boolean).join(" ")}>
      {/* rehypeRaw permite renderizar o <img> HTML (largura/alinhamento) que o
          editor gera para as imagens; o conteudo vem do CMS interno. */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitizePublicContent]}
        components={{
          a: ({ node: _node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
          h1: ({ node: _node, ...props }) => <h2 {...props} />,
          img: ({ node: _node, alt, loading, ...props }) => (
            <img alt={alt ?? ""} loading={loading ?? "lazy"} decoding="async" {...props} />
          ),
          table: ({ node: _node, ...props }) => <TableBlock {...props} />,
          blockquote: ({ node: _node, ...props }) => <CalloutBlock {...props} />,
          pre: ({ node }) => {
            const codeBlock = readCodeBlockFromPre(node as HastNode);
            if (codeBlock.language === "mermaid") {
              return <MermaidDiagram code={codeBlock.code} />;
            }
            return <CodeBlock code={codeBlock.code} language={codeBlock.language} />;
          },
          code: ({ node: _node, className, children, ...props }) => (
            <code className={className} {...props}>
              {children}
            </code>
          ),
        }}
      >
        {normalizedMarkdown}
      </ReactMarkdown>
    </div>
  );
}

function rehypeSanitizePublicContent() {
  return (tree: HastNode) => {
    sanitizeChildren(tree);
  };
}

const ALLOWED_TAGS = new Set([
  "a",
  "aside",
  "b",
  "blockquote",
  "br",
  "code",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const BLOCKED_TAGS = new Set([
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "object",
  "script",
  "style",
  "svg",
  "textarea",
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "float",
  "height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "text-align",
  "width",
]);

function sanitizeChildren(node: HastNode): void {
  if (!Array.isArray(node.children)) {
    return;
  }

  const sanitizedChildren: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "element") {
      const tagName = String(child.tagName ?? "").toLowerCase();
      if (BLOCKED_TAGS.has(tagName)) {
        continue;
      }
      if (!ALLOWED_TAGS.has(tagName)) {
        sanitizeChildren(child);
        sanitizedChildren.push(...(child.children ?? []));
        continue;
      }

      child.tagName = tagName;
      child.properties = sanitizeProperties(tagName, child.properties ?? {});
      sanitizeChildren(child);
    } else {
      sanitizeChildren(child);
    }
    sanitizedChildren.push(child);
  }

  node.children = sanitizedChildren;
}

function sanitizeProperties(
  tagName: string,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("on")) {
      continue;
    }

    if (tagName === "a" && normalizedKey === "href" && isSafeUrl(value)) {
      sanitized.href = String(value);
      sanitized.target = "_blank";
      sanitized.rel = "noreferrer";
      continue;
    }

    if (tagName === "img" && normalizedKey === "src" && isSafeUrl(value)) {
      sanitized.src = String(value);
      continue;
    }

    if (["alt", "title"].includes(normalizedKey) && typeof value === "string") {
      sanitized[normalizedKey] = value;
      continue;
    }

    if (["width", "height", "colspan", "rowspan"].includes(normalizedKey)) {
      const numericValue = sanitizePositiveInteger(value);
      if (numericValue !== undefined) {
        sanitized[normalizedKey] = numericValue;
      }
      continue;
    }

    if (tagName === "img" && normalizedKey === "loading" && isLoadingValue(value)) {
      sanitized.loading = value;
      continue;
    }

    if (tagName === "img" && normalizedKey === "decoding" && isDecodingValue(value)) {
      sanitized.decoding = value;
      continue;
    }

    if (tagName === "figure" && normalizedKey === "datadisposition" && isDispositionValue(value)) {
      sanitized["data-disposition"] = value;
      continue;
    }

    if (tagName === "p" && normalizedKey === "datafloatspacer" && value === "true") {
      sanitized["data-float-spacer"] = "true";
      continue;
    }

    if (["pre", "code"].includes(tagName) && normalizedKey === "datalanguage") {
      const language = sanitizeToken(value);
      if (language) {
        sanitized["data-language"] = language;
      }
      continue;
    }

    if (["pre", "code"].includes(tagName) && normalizedKey === "classname") {
      const classNames = sanitizeClassNames(value);
      if (classNames.length > 0) {
        sanitized.className = classNames;
      }
      continue;
    }

    if (["figure", "img", "span"].includes(tagName) && normalizedKey === "style") {
      const style = sanitizeStyle(value);
      if (style) {
        sanitized.style = style;
      }
    }
  }

  return sanitized;
}

function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f]/.test(trimmed)) {
    return false;
  }
  return /^(https?:|mailto:|tel:|\/|#|\?|\.)/i.test(trimmed);
}

function sanitizePositiveInteger(value: unknown): number | undefined {
  const numericValue = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined;
  }
  return Math.round(numericValue);
}

function isLoadingValue(value: unknown): value is "eager" | "lazy" {
  return value === "eager" || value === "lazy";
}

function isDecodingValue(value: unknown): value is "async" | "auto" | "sync" {
  return value === "async" || value === "auto" || value === "sync";
}

function isDispositionValue(value: unknown): value is string {
  return (
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "float-left" ||
    value === "float-right"
  );
}

function sanitizeToken(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const token = value.replace(/^language-/, "").trim();
  return /^[a-z0-9_-]{1,40}$/i.test(token) ? token : "";
}

function sanitizeClassNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(sanitizeToken)
    .filter(Boolean)
    .map((token) => (token.startsWith("language-") ? token : `language-${token}`));
}

function sanitizeStyle(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  if (/url\s*\(|expression\s*\(|behavior\s*:|javascript:|[<>]/i.test(value)) {
    return "";
  }

  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex === -1) {
        return "";
      }
      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const propertyValue = declaration.slice(separatorIndex + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
        return "";
      }
      if (!/^[a-z0-9\s.,%()#:+-]+$/i.test(propertyValue)) {
        return "";
      }
      return `${property}:${propertyValue}`;
    })
    .filter(Boolean)
    .join(";");
}

function normalizeFloatingFigures(markdown: string): string {
  if (!isHtmlContent(markdown) || !/<figure\b[^>]*data-disposition=["']float-/i.test(markdown)) {
    return markdown;
  }
  if (typeof DOMParser === "undefined") {
    return markdown;
  }

  const document = new DOMParser().parseFromString(markdown, "text/html");
  for (const figure of Array.from(document.querySelectorAll("figure[data-disposition^='float']"))) {
    const previousElement = figure.previousElementSibling;
    if (!previousElement || !isTextBlockElement(previousElement) || isBlankElement(previousElement)) {
      continue;
    }
    previousElement.before(figure);
  }

  return document.body.innerHTML;
}

function isHtmlContent(content: string): boolean {
  return /^\s*<(?:[a-z]+|!)/i.test(content);
}

function isTextBlockElement(element: Element): boolean {
  return ["P", "UL", "OL", "BLOCKQUOTE"].includes(element.tagName);
}

function isBlankElement(element: Element): boolean {
  return element.textContent?.trim().length === 0;
}

function readCodeBlockFromPre(node: HastNode): { code: string; language: string } {
  const codeNode = findCodeNode(node) ?? node;
  return {
    code: extractText(node).replace(/\n$/, ""),
    language: readLanguage(node) || readLanguage(codeNode),
  };
}

function findCodeNode(node: HastNode): HastNode | undefined {
  if (node.tagName === "code") {
    return node;
  }
  return node.children?.map(findCodeNode).find(Boolean);
}

function extractText(node: HastNode): string {
  if (typeof node.value === "string") {
    return node.value;
  }
  return node.children?.map(extractText).join("") ?? "";
}

function readLanguage(node: HastNode): string {
  const properties = node.properties ?? {};
  const dataLanguage = properties["data-language"] ?? properties.dataLanguage;
  if (typeof dataLanguage === "string") {
    return dataLanguage.replace(/^language-/, "");
  }

  const className = properties.className;
  const classNames = Array.isArray(className) ? className : [className];
  for (const value of classNames) {
    if (typeof value !== "string") {
      continue;
    }
    const match = /language-(\w[\w-]*)/.exec(value);
    if (match) {
      return match[1];
    }
  }

  return "";
}
