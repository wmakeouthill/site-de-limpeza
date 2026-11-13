import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListModal } from "../components/ListModal";
import { ListButton } from "../components/ListButton";

describe("ListModal & ListButton components", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "prod-1",
          nome: "Detergente Neutro",
          tamanho: "500 ml",
          preco_atual: "4.50",
          preco_de: "4.50",
          promo_ativa: false,
        },
      ],
    }));
    // Mock window.open
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza empty state quando a lista não possui produtos", () => {
    render(
      <ListModal
        isOpen={true}
        onClose={vi.fn()}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    expect(screen.getByText("Sua lista está vazia")).toBeTruthy();
    expect(screen.getByText("Ver produtos")).toBeTruthy();
  });

  it("não renderiza nada se isOpen for false", () => {
    const { container } = render(
      <ListModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("permite alternar para modalidade de entrega e digitar bairro", async () => {
    localStorage.setItem("talimpo-lista", JSON.stringify({ "prod-1": 2 }));

    render(
      <ListModal
        isOpen={true}
        onClose={vi.fn()}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    // Espera os produtos serem carregados
    const entregaBtn = await screen.findByText("Entrega na região");
    expect(entregaBtn).toBeTruthy();

    fireEvent.click(entregaBtn);

    const bairroInput = screen.getByLabelText(/Bairro para entrega \*/i);
    expect(bairroInput).toBeTruthy();

    fireEvent.change(bairroInput, { target: { value: "Anil" } });
    expect((bairroInput as HTMLInputElement).value).toBe("Anil");
  });

  it("renderiza ListButton e exibe contador correto do storage", () => {
    localStorage.setItem("talimpo-lista", JSON.stringify({ "prod-1": 3 }));

    render(<ListButton lojaNome="Falcão Limpeza" whatsappNumero="5521999999999" />);

    expect(screen.getByText("Minha lista")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
