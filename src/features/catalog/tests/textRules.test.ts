import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Regras de texto e vocabulário proibido (CA-28, Seção 12)", () => {
  // Termos terminantemente proibidos na experiência e interface do site
  const FORBIDDEN_TERMS = [
    "vitrine",
    "carrinho",
    "finalizar pedido",
    "comprar agora",
    "nota fiscal para cnpj",
  ];

  function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== "dist") {
          getAllSourceFiles(fullPath, fileList);
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".astro") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".ts")) &&
        !entry.name.includes(".test.") &&
        !entry.name.endsWith("textRules.test.ts")
      ) {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  it("não deve conter termos proibidos de e-commerce em nenhum arquivo do código-fonte (CA-28)", () => {
    const srcDir = path.resolve(__dirname, "../../../");
    const files = getAllSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(10);

    const violations: { file: string; line: number; term: string; snippet: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, idx) => {
        const lower = lineText.toLowerCase();
        for (const term of FORBIDDEN_TERMS) {
          if (lower.includes(term.toLowerCase())) {
            violations.push({
              file: path.relative(srcDir, file),
              line: idx + 1,
              term,
              snippet: lineText.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `[${v.file}:${v.line}] contém termo proibido "${v.term}": "${v.snippet}"`)
        .join("\n");
      expect.fail(`Encontradas violações do vocabulário proibido (CA-28):\n${details}`);
    }

    expect(violations).toHaveLength(0);
  });
});
