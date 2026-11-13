import type { PublicProduto } from "@/lib/server/publicCatalog";

export function normalizeText(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface FilterProductsParams {
  q?: string;
  departamento?: string;
  precoRange?: "" | "10" | "30" | "30+";
  soOfertas?: boolean;
  embalagemGrande?: boolean;
  marcas?: string[];
  ordem?: "pop" | "menor" | "desc" | "az";
}

export function filterAndSortProducts(
  produtos: PublicProduto[],
  params: FilterProductsParams
): PublicProduto[] {
  let result = [...produtos];

  // 1. Busca textual (CA-24)
  if (params.q && params.q.trim()) {
    const rawTerms = params.q.trim().split(/\s+/).filter(Boolean);
    const searchTerms = rawTerms.map(normalizeText);

    result = result.filter((prod) => {
      const haystack = normalizeText(
        [
          prod.nome,
          prod.marca,
          prod.departamento_nome || "",
          prod.descricao,
          prod.tamanho,
        ].join(" ")
      );

      // Exige que todos os termos estejam presentes (AND)
      return searchTerms.every((term) => haystack.includes(term));
    });
  }

  // 2. Filtro de departamento
  if (params.departamento && params.departamento !== "todos") {
    const deptNorm = normalizeText(params.departamento);
    result = result.filter(
      (p) =>
        normalizeText(p.departamento_slug || "") === deptNorm ||
        normalizeText(p.departamento_nome || "") === deptNorm ||
        p.departamento_id === params.departamento
    );
  }

  // 3. Faixa de preço
  if (params.precoRange) {
    result = result.filter((p) => {
      const priceNum = parseFloat(p.preco_atual.replace(",", "."));
      if (isNaN(priceNum)) return true;

      switch (params.precoRange) {
        case "10":
          return priceNum <= 10.0;
        case "30":
          return priceNum > 10.0 && priceNum <= 30.0;
        case "30+":
          return priceNum > 30.0;
        default:
          return true;
      }
    });
  }

  // 4. Só ofertas
  if (params.soOfertas) {
    result = result.filter((p) => p.promo_ativa && Boolean(p.preco_por));
  }

  // 5. Embalagem grande
  if (params.embalagemGrande) {
    result = result.filter((p) => p.embalagem_grande);
  }

  // 6. Marcas
  if (params.marcas && params.marcas.length > 0) {
    const selectedNorm = new Set(params.marcas.map(normalizeText));
    result = result.filter((p) => selectedNorm.has(normalizeText(p.marca || "")));
  }

  // 7. Ordenação
  const ordem = params.ordem || "pop";
  result.sort((a, b) => {
    const priceA = parseFloat(a.preco_atual.replace(",", ".")) || 0;
    const priceB = parseFloat(b.preco_atual.replace(",", ".")) || 0;

    switch (ordem) {
      case "menor":
        return priceA - priceB;
      case "desc": {
        const descA = a.desconto_pct || 0;
        const descB = b.desconto_pct || 0;
        return descB - descA;
      }
      case "az":
        return a.nome.localeCompare(b.nome, "pt-BR");
      case "pop":
      default: {
        const ordA = a.ordem ?? 999;
        const ordB = b.ordem ?? 999;
        return ordA - ordB;
      }
    }
  });

  return result;
}
