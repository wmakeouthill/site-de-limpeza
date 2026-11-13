import { useEffect, useState } from "react";
import styles from "./CodeBlock.module.css";

type CodeBlockOptions = typeof import("@blocknote/code-block").codeBlockOptions;
type Highlighter = Awaited<ReturnType<CodeBlockOptions["createHighlighter"]>>;

interface CodeBlockProps {
  readonly code: string;
  /** Linguagem declarada no fence (ex.: "python"), sem o prefixo "language-". */
  readonly language: string;
}

type LanguageMeta = { name: string; aliases?: string[] };
const CODE_THEME = "github-light";

// Reaproveita o MESMO highlighter (Shiki) e a mesma lista de linguagens do
// editor, carregados sob demanda para nao pesar no bundle das paginas publicas.
let optionsPromise: Promise<{
  createHighlighter: () => Promise<Highlighter>;
  supportedLanguages: Record<string, LanguageMeta>;
}> | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

async function loadOptions() {
  if (!optionsPromise) {
    optionsPromise = import("@blocknote/code-block").then((m) => m.codeBlockOptions);
  }
  return optionsPromise;
}

async function loadHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = loadOptions().then((opts) => opts.createHighlighter());
  }
  return highlighterPromise;
}

/** Resolve um alias do fence (ex.: "js") para o id da linguagem ("javascript"). */
function resolveLanguage(
  supported: Record<string, LanguageMeta>,
  declared: string,
): { id: string; label: string } {
  const lower = declared.trim().toLowerCase();
  if (supported[lower]) {
    return { id: lower, label: supported[lower].name };
  }
  for (const [id, meta] of Object.entries(supported)) {
    if (meta.aliases?.includes(lower)) {
      return { id, label: meta.name };
    }
  }
  return { id: "text", label: declared || "Texto" };
}

/**
 * Bloco de codigo no estilo Notion: cabecalho com o nome da linguagem e corpo
 * com syntax highlight (Shiki, tema github-light, igual ao editor do CMS).
 */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [label, setLabel] = useState(language || "Texto");

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [opts, highlighter] = await Promise.all([loadOptions(), loadHighlighter()]);
        if (!isActive) {
          return;
        }
        const { id, label: resolved } = resolveLanguage(opts.supportedLanguages, language);
        setHtml(null);
        setLabel(resolved);
        await Promise.all([
          highlighter.loadLanguage(id as Parameters<Highlighter["loadLanguage"]>[0]),
          highlighter.loadTheme(CODE_THEME),
        ]);
        if (isActive) {
          setHtml(highlighter.codeToHtml(code, { lang: id, theme: CODE_THEME }));
        }
      } catch {
        // Sem highlight: cai no fallback de <pre> simples abaixo.
        if (isActive) {
          setHtml(null);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [code, language]);

  return (
    <div className={styles.block}>
      <div className={styles.header}>{label}</div>
      {html ? (
        <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className={styles.body}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
