import { describe, expect, it } from "vitest";
import { formatBrl, formatWhatsAppListMessage } from "./whatsappFormatter";

describe("whatsappFormatter (RF-L03, CA-07)", () => {
  const mockItens = [
    {
      id: "p1",
      nome: "Detergente Neutro",
      tamanho: "500 ml",
      precoAtual: 2.5,
      quantidade: 2,
    },
    {
      id: "p2",
      nome: "Água Sanitária",
      tamanho: "2 L",
      precoAtual: 6.9,
      quantidade: 1,
    },
  ];

  it("formata lista residencial para retirada na loja exatamente no padrão RF-L03", () => {
    const msg = formatWhatsAppListMessage({
      lojaNome: "Falcão Limpeza",
      whatsappNumero: "5521999999999",
      itens: mockItens,
      modalidade: "retirada",
    });

    const expected = [
      "Olá, Falcão Limpeza! Montei esta lista no site:",
      "",
      `• 2x Detergente Neutro 500 ml - ${formatBrl(2.5)} un. = ${formatBrl(5.0)}`,
      `• 1x Água Sanitária 2 L - ${formatBrl(6.9)} un. = ${formatBrl(6.9)}`,
      "",
      `Total estimado: ${formatBrl(11.9)}`,
      "",
      "Quero retirar na loja. Podem separar?",
    ].join("\n");

    expect(msg).toBe(expected);
  });

  it("não duplica exclamação se nome da loja já terminar com '!'", () => {
    const msg = formatWhatsAppListMessage({
      lojaNome: "Tá Limpo!",
      whatsappNumero: "5521999999999",
      itens: mockItens,
      modalidade: "retirada",
    });

    expect(msg.startsWith("Olá, Tá Limpo! Montei esta lista no site:")).toBe(true);
    expect(msg).not.toContain("Tá Limpo!!");
  });

  it("formata para entrega com bairro informado", () => {
    const msg = formatWhatsAppListMessage({
      lojaNome: "Falcão Limpeza",
      whatsappNumero: "5521999999999",
      itens: mockItens,
      modalidade: "entrega",
      bairro: "Rio das Pedras",
    });

    expect(msg).toContain("Vocês entregam em: Rio das Pedras?");
  });

  it("usa fallback '(meu bairro)' se bairro não for preenchido", () => {
    const msg = formatWhatsAppListMessage({
      lojaNome: "Falcão Limpeza",
      whatsappNumero: "5521999999999",
      itens: mockItens,
      modalidade: "entrega",
    });

    expect(msg).toContain("Vocês entregam em: (meu bairro)?");
  });

  it("acrescenta nome do cliente e tag de empresa se fornecidos", () => {
    const msg = formatWhatsAppListMessage({
      lojaNome: "Falcão Limpeza",
      whatsappNumero: "5521999999999",
      itens: mockItens,
      modalidade: "retirada",
      nomeCliente: "Carlos",
      isEmpresa: true,
    });

    expect(msg).toContain("\nNome: Carlos (Compra para empresa)");
  });
});
