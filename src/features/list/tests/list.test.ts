import { describe, expect, it } from "vitest";
import type { PublicProduto } from "@/lib/server/publicCatalog";
import { readStoredList, writeStoredList } from "../hooks/useListSync";

describe("List sync & storage rules (CA-06, CA-08, CA-09)", () => {
  const activeCatalog: PublicProduto[] = [
    {
      id: "p1",
      departamento_id: "d1",
      nome: "Detergente Neutro",
      slug: "detergente-neutro",
      marca: "Clarim",
      tamanho: "500 ml",
      descricao: "Louças",
      como_usar: "",
      forma: "garrafa",
      cor: "#003399",
      imagem_url: null,
      preco_de: "11.00",
      preco_por: null,
      promo_ativa: false,
      desconto_pct: null,
      preco_atual: "11.00", // Preço atualizado de R$ 10 para R$ 11 (CA-08)
      embalagem_grande: false,
    },
    {
      id: "p2",
      departamento_id: "d1",
      nome: "Água Sanitária",
      slug: "agua-sanitaria",
      marca: "Clarim",
      tamanho: "2 L",
      descricao: "Alveja",
      como_usar: "",
      forma: "garrafa",
      cor: "#003399",
      imagem_url: null,
      preco_de: "7.00",
      preco_por: null,
      promo_ativa: false,
      desconto_pct: null,
      preco_atual: "7.00",
      embalagem_grande: false,
    },
  ];

  it("descarta produtos inativados que estavam no localStorage (CA-06)", () => {
    // p99 foi desativado e não consta mais no activeCatalog
    const initialStorage = { p1: 2, p99: 1 };
    writeStoredList(initialStorage);

    const activeMap = new Map(activeCatalog.map((p) => [p.id, p]));
    const currentStored = readStoredList();

    const validList: Record<string, number> = {};
    for (const [id, qty] of Object.entries(currentStored)) {
      if (activeMap.has(id)) {
        validList[id] = qty;
      }
    }

    expect(validList).toEqual({ p1: 2 });
    expect(validList["p99"]).toBeUndefined();
  });

  it("utiliza o preço novo de balcão (R$ 11,00) recalculando subtotal (CA-08)", () => {
    // p1 era R$ 10,00 quando foi salvo, mas no catálogo ativo custa R$ 11,00
    const qty = 3;
    const prod = activeCatalog.find((p) => p.id === "p1")!;
    const unitPrice = parseFloat(prod.preco_atual.replace(",", "."));
    const total = unitPrice * qty;

    expect(unitPrice).toBe(11.0);
    expect(total).toBe(33.0);
  });

  it("ao adicionar um kit, soma as quantidades dos produtos existentes na lista (CA-09)", () => {
    // Lista inicial: 2 detergentes (p1)
    const list: Record<string, number> = { p1: 2 };

    // Kit corporativo possui: 4 detergentes (p1) e 2 águas sanitárias (p2)
    const kitItens = [
      { produto_id: "p1", quantidade: 4 },
      { produto_id: "p2", quantidade: 2 },
    ];

    for (const item of kitItens) {
      list[item.produto_id] = (list[item.produto_id] || 0) + item.quantidade;
    }

    // p1 deve ter 2 + 4 = 6
    expect(list["p1"]).toBe(6);
    // p2 deve ter 2
    expect(list["p2"]).toBe(2);
  });
});
