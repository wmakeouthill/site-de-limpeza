// @vitest-environment happy-dom
import {
  BlockNoteEditor,
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { describe, expect, it } from "vitest";
import { parseMarkdownPasteToBlocks } from "./MarkdownEditor.paste";

// Mesma config do MarkdownEditor: o bloco de codigo do @blocknote/code-block
// (com mermaid na lista de linguagens).
const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, codeBlock: createCodeBlockSpec(codeBlockOptions) },
});

const MARKDOWN = `# Titulo

Paragrafo.

\`\`\`python
def f(x):
    return x + 1
\`\`\`

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

Fim.`;

describe("paste de markdown com codigo", () => {
  // Regressao do bug em que colar markdown perdia os blocos de codigo. O
  // MarkdownEditor converte o markdown com tryParseMarkdownToBlocks (remark) e
  // insere os blocos direto, evitando a transacao de paste do ProseMirror — que
  // no navegador removia os fences (```). Aqui exercitamos esse mesmo caminho.
  it("tryParseMarkdownToBlocks preserva os codeBlocks (python e mermaid)", async () => {
    const editor = BlockNoteEditor.create({ schema });
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor.mount(el);

    const blocks = await editor.tryParseMarkdownToBlocks(MARKDOWN);
    editor.replaceBlocks(editor.document, blocks);

    const langs = editor.document
      .filter((b) => b.type === "codeBlock")
      .map((b) => (b.props as { language?: string }).language);
    expect(langs).toEqual(expect.arrayContaining(["python", "mermaid"]));
  });

  it("serializa os codeBlocks para HTML com a classe da linguagem", async () => {
    const editor = BlockNoteEditor.create({ schema });
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor.mount(el);

    const blocks = await editor.tryParseMarkdownToBlocks(MARKDOWN);
    editor.replaceBlocks(editor.document, blocks);

    const html = await editor.blocksToHTMLLossy(editor.document);
    expect(html).toContain("language-python");
    expect(html).toContain("language-mermaid");
  });

  it("parseMarkdownPasteToBlocks preserva fences e delega o restante ao parser", async () => {
    const editor = BlockNoteEditor.create({ schema });
    const el = document.createElement("div");
    document.body.appendChild(el);
    editor.mount(el);

    const blocks = await parseMarkdownPasteToBlocks(editor, MARKDOWN);
    editor.replaceBlocks(editor.document, blocks);

    expect(editor.document[0].type).toBe("heading");

    const langs = editor.document
      .filter((b) => b.type === "codeBlock")
      .map((b) => (b.props as { language?: string }).language);
    expect(langs).toEqual(["python", "mermaid"]);

    const html = await editor.blocksToHTMLLossy(editor.document);
    expect(html).toContain("language-python");
    expect(html).toContain("language-mermaid");
  });
});
