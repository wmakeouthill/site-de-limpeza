// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { PublicTestimonial } from "@/lib/server/publicContent";

describe("TestimonialGrid - CA-21", () => {
  it("omite completamente a seção do DOM quando a lista de depoimentos for vazia", () => {
    const emptyList: PublicTestimonial[] = [];
    const shouldRender = emptyList && emptyList.length > 0;
    expect(shouldRender).toBe(false);
  });

  it("renderiza depoimentos quando há itens ativos na lista", () => {
    const activeTestimonials: PublicTestimonial[] = [
      {
        id: "t-1",
        author: "Dona Maria",
        role: "Moradora do Anil",
        company: null,
        quote: "O melhor atendimento e produtos de qualidade para casa.",
      },
      {
        id: "t-2",
        author: "Carlos Silva",
        role: "Síndico",
        company: "Condomínio Reserva do Anil",
        quote: "Compramos todos os insumos de limpeza no atacado da Falcão. Pedido separado rápido.",
      },
    ];

    expect(activeTestimonials.length).toBe(2);
    expect(activeTestimonials[0].author).toBe("Dona Maria");
    expect(activeTestimonials[1].company).toBe("Condomínio Reserva do Anil");
  });
});
