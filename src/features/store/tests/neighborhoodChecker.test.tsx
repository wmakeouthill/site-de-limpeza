import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NeighborhoodChecker } from "../components/NeighborhoodChecker";

describe("NeighborhoodChecker (CA-11, RF-P09)", () => {
  const bairrosMock = [
    "Anil",
    "Rio das Pedras",
    "Gardênia Azul",
    "Freguesia",
    "Itanhangá",
    "Muzema",
    "Tijuquinha",
    "Cidade de Deus",
    "Jacarepaguá",
    "Taquara",
    "Pechincha",
    "Barra da Tijuca",
  ];

  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("exibe aviso pedindo pelo menos 3 letras quando entrada tem < 3 caracteres (CA-11)", () => {
    render(
      <NeighborhoodChecker
        bairros={bairrosMock}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    const input = screen.getByLabelText(/Digite seu bairro/i);
    const submitBtn = screen.getByText("Consultar");

    fireEvent.change(input, { target: { value: "An" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("Digite pelo menos 3 letras do bairro.")).toBeTruthy();
  });

  it("localiza bairro atendido de forma insensível a caixa e acentos (CA-11)", () => {
    render(
      <NeighborhoodChecker
        bairros={bairrosMock}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    const input = screen.getByLabelText(/Digite seu bairro/i);
    const submitBtn = screen.getByText("Consultar");

    // "freguesia" sem maiúscula
    fireEvent.change(input, { target: { value: "freguesia" } });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/está na nossa rota de entrega/i)
    ).toBeTruthy();

    const waLink = screen.getByText("Combinar entrega").closest("a") as HTMLAnchorElement;
    expect(waLink).toBeTruthy();
    expect(waLink.href).toContain(encodeURIComponent("Moro em Freguesia. Como funciona a entrega?"));
  });

  it("exibe mensagem informativa e botão para perguntar quando o bairro não está na rota (CA-11)", () => {
    render(
      <NeighborhoodChecker
        bairros={bairrosMock}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    const input = screen.getByLabelText(/Digite seu bairro/i);
    const submitBtn = screen.getByText("Consultar");

    fireEvent.change(input, { target: { value: "Copacabana" } });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/ainda não está na lista, mas vale perguntar/i)
    ).toBeTruthy();

    const waLink = screen.getByText("Perguntar no WhatsApp").closest("a") as HTMLAnchorElement;
    expect(waLink).toBeTruthy();
    expect(waLink.href).toContain(encodeURIComponent("Vocês entregam em Copacabana?"));
  });

  it("permite clicar em um chip de bairro da lista para consultar de imediato", () => {
    render(
      <NeighborhoodChecker
        bairros={bairrosMock}
        lojaNome="Falcão Limpeza"
        whatsappNumero="5521999999999"
      />
    );

    const chip = screen.getByRole("button", { name: "Rio das Pedras" });
    fireEvent.click(chip);

    expect(
      screen.getByText(/está na nossa rota de entrega/i)
    ).toBeTruthy();
    expect(screen.getAllByText("Rio das Pedras").length).toBeGreaterThanOrEqual(2);
  });
});
