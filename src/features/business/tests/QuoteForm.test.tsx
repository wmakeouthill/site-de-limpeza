import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatQuoteWhatsAppMessage, QuoteForm } from "../components/QuoteForm";
import { AddKitToListButton } from "../components/AddKitToListButton";
import type { PublicKit } from "@/lib/server/publicCatalog";

describe("QuoteForm & AddKitToListButton (CA-09, CA-10, RF-L04)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("com campo empresa vazio, submissão foca no campo com erro e acessibilidade (CA-10)", () => {
    render(<QuoteForm lojaNome="Falcão Limpeza" whatsappNumero="5521999999999" />);

    const submitBtn = screen.getByText("Montar mensagem");
    const empresaInput = screen.getByLabelText(/Empresa \*/i) as HTMLInputElement;

    fireEvent.click(submitBtn);

    // Deve exibir mensagem com role="alert"
    const alertMsg = screen.getByRole("alert");
    expect(alertMsg).toBeTruthy();
    expect(alertMsg.textContent).toContain("Diga o nome da empresa");

    // Input deve ter aria-invalid="true"
    expect(empresaInput.getAttribute("aria-invalid")).toBe("true");

    // Foco deve estar no input
    expect(document.activeElement).toBe(empresaInput);

    // Não deve exibir a caixa de mensagem pronta
    expect(screen.queryByText(/Mensagem pronta/i)).toBeNull();
  });

  it("com empresa preenchida e campos opcionais vazios, omite CNPJ, bairro e itens (CA-10, RF-L04)", () => {
    render(<QuoteForm lojaNome="Falcão Limpeza" whatsappNumero="5521999999999" />);

    const empresaInput = screen.getByLabelText(/Empresa \*/i);
    fireEvent.change(empresaInput, { target: { value: "Condomínio Solar" } });

    const submitBtn = screen.getByText("Montar mensagem");
    fireEvent.click(submitBtn);

    // Deve exibir mensagem pronta
    expect(screen.getByText(/Mensagem pronta/i)).toBeTruthy();

    const preview = screen.getByText(/Empresa: Condomínio Solar/);
    expect(preview).toBeTruthy();
    const text = preview.textContent || "";

    // Saudação
    expect(text).toContain("Olá, Falcão Limpeza! Quero uma cotação para empresa.");
    expect(text).toContain("Empresa: Condomínio Solar");
    expect(text).toContain("Segmento: Condomínio");
    expect(text).toContain("Frequência: Compra única");

    // Não deve conter linhas opcionais
    expect(text).not.toContain("CNPJ:");
    expect(text).not.toContain("Bairro:");
    expect(text).not.toContain("Preciso de:");
  });

  it("com todos os campos preenchidos, formata mensagem completa e link do WhatsApp (CA-10)", () => {
    const formatted = formatQuoteWhatsAppMessage(
      {
        empresa: "Restaurante Sabor do Anil",
        cnpj: "12.345.678/0001-90",
        segmento: "Restaurante ou lanchonete",
        bairro: "Anil",
        frequencia: "Toda semana",
        itens: "10 galões de cloro 5L, 5 caixas de sabão em pó",
      },
      "Falcão Limpeza"
    );

    const expected = [
      "Olá, Falcão Limpeza! Quero uma cotação para empresa.",
      "",
      "Empresa: Restaurante Sabor do Anil",
      "CNPJ: 12.345.678/0001-90",
      "Segmento: Restaurante ou lanchonete",
      "Bairro: Anil",
      "Frequência: Toda semana",
      "",
      "Preciso de:",
      "10 galões de cloro 5L, 5 caixas de sabão em pó",
    ].join("\n");

    expect(formatted).toBe(expected);
  });

  it("não repete exclamação na saudação se nome da loja terminar em '!'", () => {
    const formatted = formatQuoteWhatsAppMessage(
      {
        empresa: "Loja ABC",
        cnpj: "",
        segmento: "Comércio",
        bairro: "",
        frequencia: "Todo mês",
        itens: "",
      },
      "Tá Limpo!"
    );

    expect(formatted).toContain("Olá, Tá Limpo! Quero uma cotação para empresa.");
    expect(formatted).not.toContain("Tá Limpo!!");
  });

  it("AddKitToListButton soma quantidades do kit aos produtos já existentes na lista (CA-09)", () => {
    // Lista inicial: 1 detergente ("p1")
    localStorage.setItem("talimpo-lista", JSON.stringify({ p1: 1 }));

    const mockKit: PublicKit = {
      id: "kit-condominio",
      nome: "Kit Condomínio Básico",
      slug: "kit-condominio-basico",
      descricao: "Essencial para portaria",
      publico: "Condomínio",
      ordem: 1,
      itens: [
        { id: "i1", produto_id: "p1", quantidade: 5, ordem: 1 },
        { id: "i2", produto_id: "p2", quantidade: 2, ordem: 2 },
      ],
    };

    render(<AddKitToListButton kit={mockKit} />);

    const addBtn = screen.getByText("Pôr o kit na lista");
    fireEvent.click(addBtn);

    const updated = JSON.parse(localStorage.getItem("talimpo-lista") || "{}");
    // p1 deve ser 1 + 5 = 6
    expect(updated["p1"]).toBe(6);
    // p2 deve ser 2
    expect(updated["p2"]).toBe(2);
  });
});
