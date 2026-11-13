import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  PanelLeft,
  PanelRight,
  X,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ContentRenderer } from "@/features/content/components/ContentRenderer";
import { uploadCmsImage } from "../../services/cmsUpload.service";
import { parseMarkdownPasteToBlocks } from "./MarkdownEditor.paste";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  readonly value: string;
  readonly onChange: (content: string) => void;
}

// Substitui o bloco de codigo padrao pelo do @blocknote/code-block: seletor de
// linguagem + syntax highlight (Shiki). A lista inclui "mermaid", entao um
// ```mermaid vira um codeBlock serializado como <pre><code class="language-mermaid">,
// que o ContentRenderer publico transforma em diagrama.
const codeBlockSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});

type EditorInstance = ReturnType<typeof useCreateBlockNote>;
type EditorBlock = EditorInstance["document"][number];

/** Disposicao da imagem em relacao ao texto (estilo Word). */
type Disposition = "left" | "center" | "right" | "float-left" | "float-right";
type DispositionsMap = Map<string, Disposition>;
type ImageDimensions = { width: number; height: number };
type ImageDimensionsMap = Map<string, ImageDimensions>;
type FloatingToolbarPosition = { top: number; left: number };
type SerializedPart = { html: string; float: boolean; spacer: boolean; textLike: boolean };

const DISPOSITION_OPTIONS: ReadonlyArray<{
  mode: Disposition;
  label: string;
  Icon: typeof AlignLeft;
}> = [
  { mode: "left", label: "Bloco à esquerda", Icon: AlignLeft },
  { mode: "center", label: "Bloco centralizado", Icon: AlignCenter },
  { mode: "right", label: "Bloco à direita", Icon: AlignRight },
  { mode: "float-left", label: "Imagem à esquerda, texto ao lado", Icon: PanelLeft },
  { mode: "float-right", label: "Imagem à direita, texto ao lado", Icon: PanelRight },
];

/**
 * Editor estilo Notion (BlockNote): menu de "/" com todos os blocos, edicao
 * WYSIWYG inline e upload de imagem arrastando/colando.
 *
 * O conteudo e persistido como HTML. Como o BlockNote nao guarda alinhamento nem
 * disposicao da imagem, cada imagem e serializada manualmente num <figure> com
 * `float`/`text-align`, e a disposicao escolhida fica num mapa (por id de bloco)
 * restaurado a partir do HTML ao carregar. Conteudo antigo em markdown e lido
 * via fallback.
 */
export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const lastExternalContent = useRef<string | null>(null);
  const lastEmittedContent = useRef<string>("");
  const changeVersion = useRef(0);
  const dispositions = useRef<DispositionsMap>(new Map());
  const imageDimensions = useRef<ImageDimensionsMap>(new Map());

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition>("left");
  const [floatingToolbarPosition, setFloatingToolbarPosition] =
    useState<FloatingToolbarPosition | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const editor = useCreateBlockNote({
    schema: codeBlockSchema,
    // Cola markdown cru preservando fences; o paste HTML do editor pode perder
    // a semantica de ```lang e ```mermaid dependendo da origem do clipboard.
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (text && looksLikeMarkdown(text)) {
        void (async () => {
          const blocks = await parseMarkdownPasteToBlocks(editor, text);
          if (blocks.length === 0) {
            return;
          }
          const reference = editor.getTextCursorPosition().block;
          const isEmptyParagraph =
            reference.type === "paragraph" &&
            Array.isArray(reference.content) &&
            reference.content.length === 0;
          // Substitui o paragrafo vazio atual (cursor recem-posicionado) em vez de
          // deixar uma linha em branco antes do conteudo colado.
          if (isEmptyParagraph) {
            editor.replaceBlocks([reference], blocks);
          } else {
            editor.insertBlocks(blocks, reference, "after");
          }
        })();
        return true;
      }
      return defaultPasteHandler();
    },
    uploadFile: async (file: File) => {
      const dimensions = await readLocalImageDimensions(file);
      const result = await uploadCmsImage(file);
      if (dimensions) {
        imageDimensions.current.set(result.url, dimensions);
      }
      return result.url;
    },
  });

  const emitChange = useCallback(async () => {
    const version = ++changeVersion.current;
    const html = await serializeDocument(editor, dispositions.current, imageDimensions.current);
    if (version !== changeVersion.current) {
      return;
    }
    lastEmittedContent.current = html;
    setPreviewHtml(html);
    onChange(html);
  }, [editor, onChange]);

  // Carrega conteudo externo (ex.: ao buscar um artigo/case do servidor).
  useEffect(() => {
    const incoming = value || "";
    if (
      incoming === lastEmittedContent.current ||
      incoming === lastExternalContent.current
    ) {
      return;
    }

    let isActive = true;
    const version = ++changeVersion.current;
    void (async () => {
      const isHtml = isHtmlContent(incoming);
      const parsed = isHtml
        ? await editor.tryParseHTMLToBlocks(incoming)
        : await editor.tryParseMarkdownToBlocks(incoming);
      if (!isActive || version !== changeVersion.current) {
        return;
      }

      const next = parsed.length > 0 ? parsed : [{ type: "paragraph" as const }];
      editor.replaceBlocks(editor.document, next);

      dispositions.current.clear();
      imageDimensions.current.clear();
      if (isHtml) {
        const modes = readDispositionsFromHtml(incoming);
        for (const [src, dimensions] of readImageDimensionsFromHtml(incoming)) {
          imageDimensions.current.set(src, dimensions);
        }
        let index = 0;
        for (const block of editor.document) {
          if (block.type === "image") {
            const mode = modes[index++] ?? "left";
            dispositions.current.set(block.id, mode);
            const alignment = dispositionToAlignment(mode);
            if (block.props.textAlignment !== alignment) {
              editor.updateBlock(block, { props: { textAlignment: alignment } });
            }
          }
        }
      }

      lastExternalContent.current = incoming;
      lastEmittedContent.current = incoming;
      setPreviewHtml(incoming);
    })();

    return () => {
      isActive = false;
    };
  }, [value, editor]);


  // Detecta clique numa imagem para mostrar a barra de disposicao.
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const clickedImage = findClickedImageBlock(event.target as HTMLElement, editor);
    if (!clickedImage) {
      setSelectedImageId(null);
      setFloatingToolbarPosition(null);
      return;
    }

    setSelectedImageId(clickedImage.block.id);
    setFloatingToolbarPosition(calculateFloatingToolbarPosition(clickedImage.element));
    setSelectedDisposition(
      dispositions.current.get(clickedImage.block.id) ??
        alignmentToDisposition(clickedImage.block.props.textAlignment),
    );
  }

  function applyDisposition(mode: Disposition) {
    if (!selectedImageId) {
      return;
    }
    dispositions.current.set(selectedImageId, mode);
    setSelectedDisposition(mode);

    const block = findImageBlock(editor, selectedImageId);
    const alignment = dispositionToAlignment(mode);
    if (block && block.props.textAlignment !== alignment) {
      // Dispara o onChange do editor, que re-serializa via emitChange.
      editor.updateBlock(block, { props: { textAlignment: alignment } });
    } else {
      void emitChange();
    }
  }

  function handleEditorMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        '[contenteditable="true"], button, input, textarea, a, [role="button"], [role="menuitem"], figure',
      )
    ) {
      return;
    }

    const lastBlock = editor.document.at(-1);
    if (lastBlock) {
      editor.setTextCursorPosition(lastBlock, "end");
    }
    editor.focus();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarHint}>
          Clique numa imagem para definir a disposição em relação ao texto.
        </span>

        <button
          type="button"
          className={styles.previewButton}
          onClick={() => setIsPreviewOpen(true)}
        >
          <Eye size={16} />
          Pré-visualizar
        </button>
      </div>

      {selectedImageId && floatingToolbarPosition && (
        <ImageDispositionToolbar
          selectedDisposition={selectedDisposition}
          position={floatingToolbarPosition}
          onSelect={applyDisposition}
        />
      )}

      <div
        className={styles.editor}
        onMouseDown={handleEditorMouseDown}
        onClickCapture={handleClickCapture}
      >
        <BlockNoteView editor={editor} theme="light" onChange={emitChange} />
      </div>

      {isPreviewOpen && (
        <PreviewModal html={previewHtml} onClose={() => setIsPreviewOpen(false)} />
      )}
    </div>
  );
}

function ImageDispositionToolbar({
  selectedDisposition,
  position,
  onSelect,
}: {
  selectedDisposition: Disposition;
  position: FloatingToolbarPosition;
  onSelect: (mode: Disposition) => void;
}) {
  return (
    <div
      className={`${styles.dispositionBar} ${styles.floatingDispositionBar}`}
      role="group"
      aria-label="Disposição da imagem"
      style={{ left: position.left, top: position.top }}
    >
      <span className={styles.dispositionLabel}>Imagem:</span>
      {DISPOSITION_OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={selectedDisposition === mode}
          className={
            selectedDisposition === mode
              ? `${styles.dispositionButton} ${styles.dispositionButtonActive}`
              : styles.dispositionButton
          }
          onClick={() => onSelect(mode)}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}

function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Pré-visualização do conteúdo"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <span>Pré-visualização do conteúdo</span>
          <button type="button" onClick={onClose} aria-label="Fechar pré-visualização">
            <X size={18} />
          </button>
        </header>
        <div className={styles.modalBody}>
          <ContentRenderer markdown={html} />
        </div>
      </section>
    </div>
  );
}

/**
 * Serializa o documento em HTML. Blocos de imagem viram um <figure> proprio que
 * carrega largura E disposicao; os demais blocos usam o HTML nativo do BlockNote.
 */
async function serializeDocument(
  editor: EditorInstance,
  dispositions: DispositionsMap,
  imageDimensions: ImageDimensionsMap,
): Promise<string> {
  // Serializa em granularidade de bloco (agrupando apenas itens de lista, para
  // manter <ul>/<ol> coesos). Assim conseguimos posicionar uma imagem flutuante
  // exatamente antes do paragrafo vizinho, sem mover titulos junto.
  const parts: SerializedPart[] = [];
  const blocks = editor.document;

  for (let i = 0; i < blocks.length; ) {
    const block = blocks[i];

    if (block.type === "image" && typeof block.props?.url === "string" && block.props.url) {
      const mode = dispositions.get(block.id) ?? alignmentToDisposition(block.props.textAlignment);
      const isFloat = mode === "float-left" || mode === "float-right";
      parts.push({
        html: imageBlockToHtml(block.props, mode, imageDimensions),
        float: isFloat,
        spacer: false,
        textLike: false,
      });
      i += 1;
      continue;
    }

    if (isListItemBlock(block)) {
      const run: EditorBlock[] = [];
      while (i < blocks.length && isListItemBlock(blocks[i])) {
        run.push(blocks[i]);
        i += 1;
      }
      parts.push({
        html: await editor.blocksToHTMLLossy(run),
        float: false,
        spacer: false,
        textLike: true,
      });
      continue;
    }

    const html = await editor.blocksToHTMLLossy([block]);
    const isSpacer = isEmptyParagraphBlock(block, html);
    parts.push({
      html: isSpacer ? '<p data-float-spacer="true"></p>' : html,
      float: false,
      spacer: isSpacer,
      textLike: !isSpacer && isTextLikeBlock(block, html),
    });
    i += 1;
  }

  // Para o `float` funcionar (estilo Word), o texto que envolve a imagem precisa
  // vir DEPOIS dela no HTML. Preferimos o paragrafo de cima: quando uma imagem
  // flutuante vem apos texto, movemos o <figure> para antes desse texto.
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].float) {
      continue;
    }
    if (i > 0 && parts[i - 1].textLike && !parts[i - 1].spacer) {
      const [figure] = parts.splice(i, 1);
      parts.splice(i - 1, 0, figure);
    }
  }

  return parts
    .map((part) => part.html)
    .filter((html) => html.trim().length > 0)
    .join("\n");
}

function isListItemBlock(block: EditorBlock): boolean {
  return typeof block.type === "string" && block.type.endsWith("ListItem");
}

function isEmptyParagraphBlock(block: EditorBlock, html: string): boolean {
  if (block.type !== "paragraph") {
    return false;
  }
  return htmlToPlainText(html).length === 0;
}

function isTextLikeBlock(block: EditorBlock, html: string): boolean {
  if (html.trim().length === 0 || htmlToPlainText(html).length === 0) {
    return false;
  }
  return block.type === "paragraph" || isListItemBlock(block);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function imageBlockToHtml(
  props: Record<string, unknown>,
  mode: Disposition,
  imageDimensions: ImageDimensionsMap,
): string {
  const url = String(props.url ?? "");
  const dimensions = imageDimensions.get(url);
  const width =
    typeof props.previewWidth === "number" && props.previewWidth > 0
      ? Math.round(props.previewWidth)
      : dimensions?.width ?? 0;
  const height = calculateRenderedImageHeight(width, dimensions);
  const caption = typeof props.caption === "string" ? props.caption : "";

  const widthAttr = width > 0 ? ` width="${width}"` : "";
  const heightAttr = height > 0 ? ` height="${height}"` : "";
  const imgStyle = width > 0
    ? `width:${width}px;max-width:100%;height:auto`
    : "max-width:100%;height:auto";
  const altAttr = caption ? ` alt="${escapeHtmlAttr(caption)}"` : "";
  const figcaption = caption ? `<figcaption>${escapeHtmlText(caption)}</figcaption>` : "";

  let figStyle: string;
  if (mode === "float-left") {
    figStyle = "float:left;margin:6px 24px 12px 0;max-width:60%";
  } else if (mode === "float-right") {
    figStyle = "float:right;margin:6px 0 12px 24px;max-width:60%";
  } else {
    figStyle = `text-align:${mode}`;
  }

  return (
    `<figure data-disposition="${mode}" style="${figStyle}">` +
    `<img src="${escapeHtmlAttr(url)}"${widthAttr}${heightAttr}${altAttr} style="${imgStyle}" />` +
    `${figcaption}</figure>`
  );
}

function calculateRenderedImageHeight(
  width: number,
  dimensions: ImageDimensions | undefined,
): number {
  if (!dimensions || width <= 0 || dimensions.width <= 0 || dimensions.height <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((dimensions.height * width) / dimensions.width));
}

/** Le a disposicao de cada imagem do HTML salvo, na ordem dos blocos de imagem. */
function readDispositionsFromHtml(html: string): Disposition[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("figure"))
    .filter((figure) => figure.querySelector("img"))
    .map((figure) => {
      const declared = figure.getAttribute("data-disposition");
      if (isDisposition(declared)) {
        return declared;
      }
      if (figure.style.float === "left") {
        return "float-left";
      }
      if (figure.style.float === "right") {
        return "float-right";
      }
      return alignmentToDisposition(figure.style.textAlign);
    });
}

function readImageDimensionsFromHtml(html: string): ImageDimensionsMap {
  const dimensions = new Map<string, ImageDimensions>();
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const image of Array.from(doc.querySelectorAll("img"))) {
    const src = image.getAttribute("src") || "";
    const width = Number.parseInt(image.getAttribute("width") || "", 10);
    const height = Number.parseInt(image.getAttribute("height") || "", 10);
    if (src && width > 0 && height > 0) {
      dimensions.set(src, { width, height });
    }
  }
  return dimensions;
}

async function readLocalImageDimensions(file: File): Promise<ImageDimensions | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        resolve(width > 0 && height > 0 ? { width, height } : null);
      };
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function isDisposition(value: unknown): value is Disposition {
  return (
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "float-left" ||
    value === "float-right"
  );
}

function dispositionToAlignment(mode: Disposition): "left" | "center" | "right" {
  if (mode === "center") {
    return "center";
  }
  if (mode === "right") {
    return "right";
  }
  return "left";
}

function alignmentToDisposition(value: unknown): Disposition {
  if (value === "center") {
    return "center";
  }
  if (value === "right") {
    return "right";
  }
  return "left";
}

function findImageBlock(editor: EditorInstance, id: string): EditorBlock | undefined {
  return editor.document.find(
    (block: EditorBlock) => block.id === id && block.type === "image",
  );
}

function findClickedImageBlock(
  target: HTMLElement,
  editor: EditorInstance,
): { block: EditorBlock; element: HTMLElement } | undefined {
  const imageContainer = target.closest('[data-content-type="image"], figure, img');
  if (!(imageContainer instanceof HTMLElement)) {
    return undefined;
  }

  const blockId = imageContainer.closest("[data-id]")?.getAttribute("data-id");
  if (blockId) {
    const block = findImageBlock(editor, blockId);
    if (block) {
      return { block, element: imageContainer };
    }
  }

  const image = imageContainer instanceof HTMLImageElement
    ? imageContainer
    : imageContainer.querySelector("img");
  const source = image?.getAttribute("src") || image?.src || "";
  if (!source) {
    return undefined;
  }

  const block = editor.document.find(
    (block: EditorBlock) => block.type === "image" && imageSourcesMatch(block.props.url, source),
  );
  return block ? { block, element: imageContainer } : undefined;
}

function calculateFloatingToolbarPosition(anchor: HTMLElement): FloatingToolbarPosition {
  const rect = anchor.getBoundingClientRect();
  const gap = 10;
  const estimatedToolbarWidth = 300;
  const estimatedToolbarHeight = 42;
  const viewportPadding = 12;
  const fitsRight = rect.right + gap + estimatedToolbarWidth <= window.innerWidth;
  const preferredLeft = fitsRight ? rect.right + gap : rect.right - estimatedToolbarWidth - gap;
  const preferredTop = rect.top + gap;

  return {
    left: clamp(
      preferredLeft,
      viewportPadding,
      window.innerWidth - estimatedToolbarWidth - viewportPadding,
    ),
    top: clamp(
      preferredTop,
      viewportPadding,
      window.innerHeight - estimatedToolbarHeight - viewportPadding,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function imageSourcesMatch(blockUrl: unknown, clickedSource: string): boolean {
  if (typeof blockUrl !== "string" || !blockUrl) {
    return false;
  }

  const decodedSource = decodeURI(clickedSource);
  return (
    clickedSource === blockUrl ||
    decodedSource === blockUrl ||
    clickedSource.endsWith(blockUrl) ||
    decodedSource.endsWith(blockUrl)
  );
}

function isHtmlContent(content: string): boolean {
  return /^\s*<(?:[a-z]+|!)/i.test(content);
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function looksLikeMarkdown(text: string): boolean {
  return (
    /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|\|.*\|)/.test(text) ||
    /!\[[^\]]*\]\([^)]+\)/.test(text) ||
    /\[[^\]]+\]\([^)]+\)/.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /(^|\n)---\s*(\n|$)/.test(text)
  );
}
