// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { CmsPromocao } from "../../types/cms.types";
import { CmsPromotionEditorPage } from "./CmsPromotionEditorPage";
import { CmsPromotionPreview } from "./CmsPromotionPreview";
import { CmsPromotionsPage } from "./CmsPromotionsPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({
    children,
    title,
    primaryAction,
  }: {
    children: React.ReactNode;
    title?: string;
    primaryAction?: { label: string; href: string } | null;
  }) => (
    <div data-testid="cms-shell">
      <h1>{title}</h1>
      {primaryAction && <a href={primaryAction.href}>{primaryAction.label}</a>}
      {children}
    </div>
  ),
}));

const mockPromocoes: CmsPromocao[] = [
  {
    id: "promo-1",
    titulo: "10% OFF na Primeira Compra",
    texto: "Use o cupom e ganhe 10% de desconto.",
    imagem_url: "https://example.com/banner.png",
    tipo_acao: "cupom",
    cta_texto: "Pegar Cupom",
    cta_caminho: null,
    codigo_cupom: "PRIMEIRA10",
    produto_id: null,
    whatsapp_mensagem: "Quero usar o cupom PRIMEIRA10",
    publico: "todos",
    frequencia: "uma_vez",
    data_inicio: new Date(Date.now() - 3600000).toISOString(),
    data_fim: new Date(Date.now() + 86400000 * 7).toISOString(),
    prioridade: 10,
    is_active: true,
    situacao: "no_ar",
    views_count: 120,
    clicks_count: 24,
    taxa_clique_pct: 20.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-2",
    titulo: "Kit Limpeza Pesada com Frete Grátis",
    texto: "Confira as vantagens para empresas.",
    imagem_url: null,
    tipo_acao: "link",
    cta_texto: "Conferir Kit",
    cta_caminho: "/empresas",
    codigo_cupom: null,
    produto_id: null,
    whatsapp_mensagem: null,
    publico: "empresa",
    frequencia: "diaria",
    data_inicio: new Date(Date.now() + 86400000).toISOString(),
    data_fim: new Date(Date.now() + 86400000 * 14).toISOString(),
    prioridade: 5,
    is_active: true,
    situacao: "agendada",
    views_count: 0,
    clicks_count: 0,
    taxa_clique_pct: 0.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "promo-3",
    titulo: "Aviso de Feriado",
    texto: "Funcionamento especial nesta sexta-feira.",
    imagem_url: null,
    tipo_acao: "aviso",
    cta_texto: "Entendi",
    cta_caminho: null,
    codigo_cupom: null,
    produto_id: null,
    whatsapp_mensagem: null,
    publico: "todos",
    frequencia: "sempre",
    data_inicio: new Date(Date.now() - 86400000 * 5).toISOString(),
    data_fim: new Date(Date.now() - 86400000).toISOString(),
    prioridade: 0,
    is_active: false,
    situacao: "desligada",
    views_count: 45,
    clicks_count: 5,
    taxa_clique_pct: 11.1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let promocoesState: CmsPromocao[] = [];

vi.mock("../../services/cmsPromotions.service", () => ({
  listCmsPromocoes: vi.fn(async () => promocoesState),
  getCmsPromocao: vi.fn(async (id: string) => {
    const found = promocoesState.find((p) => p.id === id);
    if (!found) throw new Error("Promoção não encontrada");
    return found;
  }),
  createCmsPromocao: vi.fn(async (payload) => {
    const created: CmsPromocao = {
      id: `promo-${Date.now()}`,
      ...payload,
      situacao: "no_ar",
      views_count: 0,
      clicks_count: 0,
      taxa_clique_pct: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    promocoesState.push(created);
    return created;
  }),
  updateCmsPromocao: vi.fn(async (id: string, payload) => {
    const idx = promocoesState.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Promoção não encontrada");
    promocoesState[idx] = { ...promocoesState[idx], ...payload };
    return promocoesState[idx];
  }),
  deleteCmsPromocao: vi.fn(async (id: string) => {
    promocoesState = promocoesState.filter((p) => p.id !== id);
  }),
}));

beforeEach(() => {
  promocoesState = JSON.parse(JSON.stringify(mockPromocoes));
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function renderComponent(component: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<MemoryRouter>{component}</MemoryRouter>);
  });
  return container;
}

it("renderiza lista de promoções com badges de situação, métricas e cupons", async () => {
  const container = await renderComponent(<CmsPromotionsPage />);

  expect(container.textContent).toContain("Promoções de Entrada");
  expect(container.textContent).toContain("10% OFF na Primeira Compra");
  expect(container.textContent).toContain("PRIMEIRA10");
  expect(container.textContent).toContain("No ar");
  expect(container.textContent).toContain("Agendada");
  expect(container.textContent).toContain("Desligada");

  // Métricas
  expect(container.textContent).toContain("120"); // views
  expect(container.textContent).toContain("24"); // clicks
  expect(container.textContent).toContain("20%"); // ctr
});

it("alterna status ativo/inativo ao clicar no botão de power", async () => {
  const container = await renderComponent(<CmsPromotionsPage />);

  const toggleButtons = container.querySelectorAll<HTMLButtonElement>(
    'button[title="Desativar promoção"]'
  );
  expect(toggleButtons.length).toBeGreaterThan(0);

  await act(async () => {
    toggleButtons[0].click();
  });

  expect(promocoesState[0].is_active).toBe(false);
});

it("exibe estado vazio quando não há promoções cadastradas", async () => {
  promocoesState = [];
  const container = await renderComponent(<CmsPromotionsPage />);

  expect(container.textContent).toContain("Nenhuma promoção encontrada");
  expect(container.textContent).toContain("Crie sua primeira promoção de entrada");
});

it("renderiza a prévia visual em tempo real desktop e mobile com cupom e cta", async () => {
  const container = await renderComponent(
    <CmsPromotionPreview
      titulo="Super Desconto 15%"
      texto="Aproveite agora na loja física ou WhatsApp"
      tipo_acao="cupom"
      codigo_cupom="LIMPO15"
      cta_texto="Pegar meu desconto"
      publico="casa"
      device="desktop"
    />
  );

  const preview = container.querySelector('[data-testid="promotion-preview"]');
  expect(preview).toBeTruthy();
  expect(container.textContent).toContain("Super Desconto 15%");
  expect(container.textContent).toContain("LIMPO15");
  expect(container.textContent).toContain("Exclusivo para Casa");
  expect(container.textContent).toContain("Pegar meu desconto");
  expect(container.textContent).toContain("Agora não");
});

it("valida obrigatoriedade de link relativo interno no editor (CA-17)", async () => {
  const container = await renderComponent(
    <Routes>
      <Route path="/" element={<CmsPromotionEditorPage />} />
    </Routes>
  );

  // Preenche título
  const tituloInput = container.querySelector<HTMLInputElement>("#promo-titulo");
  expect(tituloInput).toBeTruthy();
  fireEvent.change(tituloInput!, { target: { value: "Promoção com Link" } });

  // Muda tipo de ação para link
  const tipoSelect = container.querySelector<HTMLSelectElement>("#promo-tipo-acao");
  expect(tipoSelect).toBeTruthy();
  fireEvent.change(tipoSelect!, { target: { value: "link" } });

  // Tenta salvar sem caminho
  const form = container.querySelector("form");
  fireEvent.submit(form!);
  expect(container.textContent).toContain("Informe o caminho interno do link.");

  // Insere URL externa proibida
  const caminhoInput = container.querySelector<HTMLInputElement>("#promo-caminho");
  expect(caminhoInput).toBeTruthy();
  fireEvent.change(caminhoInput!, { target: { value: "https://externo.com/promocao" } });
  fireEvent.submit(form!);

  expect(container.textContent).toContain(
    "O caminho do link deve ser relativo interno iniciando com '/'"
  );
});

it("valida que cupom não pode conter espaços", async () => {
  const container = await renderComponent(
    <Routes>
      <Route path="/" element={<CmsPromotionEditorPage />} />
    </Routes>
  );

  const tituloInput = container.querySelector<HTMLInputElement>("#promo-titulo");
  fireEvent.change(tituloInput!, { target: { value: "Promoção Cupom" } });

  const tipoSelect = container.querySelector<HTMLSelectElement>("#promo-tipo-acao");
  fireEvent.change(tipoSelect!, { target: { value: "cupom" } });

  // O input de cupom remove espaços automaticamente ao digitar
  const cupomInput = container.querySelector<HTMLInputElement>("#promo-cupom");
  expect(cupomInput).toBeTruthy();
  fireEvent.change(cupomInput!, { target: { value: "CUPOM INVALIDO" } });

  // Foi sanitizado para CUPOMINVALIDO
  expect(cupomInput!.value).toBe("CUPOMINVALIDO");
});
