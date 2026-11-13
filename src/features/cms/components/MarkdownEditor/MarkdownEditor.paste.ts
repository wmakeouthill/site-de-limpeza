import type { PartialBlock } from "@blocknote/core";

interface MarkdownBlockParser {
  tryParseMarkdownToBlocks: (markdown: string) => ParsedBlock[] | Promise<ParsedBlock[]>;
}

interface ParsedBlock {
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children: ParsedBlock[];
}

type MarkdownSegment =
  | { type: "markdown"; text: string }
  | { type: "code"; language: string; code: string };

export async function parseMarkdownPasteToBlocks(
  editor: MarkdownBlockParser,
  markdown: string,
): Promise<PartialBlock[]> {
  const segments = splitMarkdownByFencedCode(markdown);
  if (!segments.some((segment) => segment.type === "code")) {
    return (await editor.tryParseMarkdownToBlocks(markdown)).map(toPartialBlock);
  }

  const blocks: PartialBlock[] = [];
  for (const segment of segments) {
    if (segment.type === "code") {
      blocks.push({
        type: "codeBlock",
        props: { language: normalizeFenceLanguage(segment.language) },
        content: segment.code,
      });
      continue;
    }

    if (segment.text.trim()) {
      const parsedBlocks = await editor.tryParseMarkdownToBlocks(segment.text);
      blocks.push(...parsedBlocks.map(toPartialBlock));
    }
  }

  return blocks;
}

function toPartialBlock(block: ParsedBlock): PartialBlock {
  return {
    type: block.type,
    props: block.props,
    content: block.content as PartialBlock["content"],
    children: block.children.map(toPartialBlock),
  } as PartialBlock;
}

function splitMarkdownByFencedCode(markdown: string): MarkdownSegment[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const segments: MarkdownSegment[] = [];
  const markdownLines: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const openingFence = parseOpeningFence(lines[index]);
    if (!openingFence) {
      markdownLines.push(lines[index]);
      continue;
    }

    flushMarkdownSegment(segments, markdownLines);

    const codeLines: string[] = [];
    index++;
    while (index < lines.length) {
      if (isClosingFence(lines[index], openingFence.character, openingFence.length)) {
        break;
      }
      codeLines.push(lines[index]);
      index++;
    }

    segments.push({
      type: "code",
      language: openingFence.language,
      code: codeLines.join("\n"),
    });
  }

  flushMarkdownSegment(segments, markdownLines);
  return segments;
}

function parseOpeningFence(
  line: string,
): { character: "`" | "~"; length: number; language: string } | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) {
    return null;
  }

  return {
    character: match[1][0] as "`" | "~",
    length: match[1].length,
    language: match[2].trim(),
  };
}

function isClosingFence(line: string, character: "`" | "~", length: number): boolean {
  const escapedCharacter = character === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${escapedCharacter}{${length},}\\s*$`).test(line);
}

function flushMarkdownSegment(segments: MarkdownSegment[], markdownLines: string[]) {
  const text = markdownLines.join("\n");
  if (text.trim()) {
    segments.push({ type: "markdown", text });
  }
  markdownLines.length = 0;
}

function normalizeFenceLanguage(language: string): string {
  const token = language.trim().split(/\s+/)[0] ?? "";
  return token
    .replace(/^language-/, "")
    .replace(/^\{\.?/, "")
    .replace(/\}$/, "");
}
