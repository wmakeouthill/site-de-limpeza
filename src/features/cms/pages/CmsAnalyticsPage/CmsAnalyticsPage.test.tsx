// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CmsAnalyticsPage } from "./CmsAnalyticsPage";
import type { AnalyticsDashboard, AnalyticsPageList } from "../../types/cms.types";
import { clearCmsQueryCache } from "../../hooks/cmsQueryCache";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("../../components/CmsAuthGuard", () => ({ CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../../components/CmsShell", () => ({ CmsShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const DASHBOARD: AnalyticsDashboard = {
  overview: { visitors: 1234, pageviews: 4000, clicks: 300, formSubmits: 12, medianDwellMs: 83_000, bounceRate: 41.5 },
  period: { start: "2026-08-01", end: "2026-08-30" },
  comparisonOverview: { visitors: 1100, pageviews: 3600, clicks: 250, formSubmits: 10, medianDwellMs: 75_000, bounceRate: 43 },
  timeseries: [{ day: "2026-08-01", visitors: 10, pageviews: 20, bySite: [{ site: "falcao", visitors: 10, pageviews: 20 }] }, { day: "2026-08-02", visitors: 20, pageviews: 30, bySite: [{ site: "falcao", visitors: 20, pageviews: 30 }] }],
  comparisonTimeseries: [{ day: "2026-07-02", visitors: 8, pageviews: 18 }, { day: "2026-07-03", visitors: 15, pageviews: 25 }],
  weeklyRhythm: [{ weekday: 0, label: "Seg", visitors: 20 }, { weekday: 1, label: "Ter", visitors: 40 }],
  pagesPerSession: 3.2,
  channels: [{ site: "falcao", overview: { visitors: 1234, pageviews: 4000, clicks: 300, formSubmits: 12, medianDwellMs: 83_000, bounceRate: 41.5 } }],
  funnel: [{ step: "pageview", label: "Sessões", sessions: 100, rate: 100, bySite: [{ site: "falcao", count: 100 }] }, { step: "form_submit", label: "Enviou formulário", sessions: 5, rate: 5, bySite: [{ site: "falcao", count: 5 }] }],
  topPages: [{ label: "/", count: 900, posX: null, posY: null, bySite: [{ site: "falcao", count: 900 }] }], topCtas: [{ label: "Falar com advogado @ hero", count: 42, posX: 60, posY: 30, bySite: [{ site: "falcao", count: 42 }] }], sources: [{ label: "google.com", count: 300, posX: null, posY: null, bySite: [{ site: "falcao", count: 300 }] }], devices: [{ label: "mobile", count: 700, posX: null, posY: null, bySite: [{ site: "falcao", count: 700 }] }],
  whatsappClicks: [{ label: "lista", count: 85, posX: null, posY: null, bySite: [{ site: "falcao", count: 85 }] }],
  topListaProducts: [{ label: "prod-agua-sanitaria-2l", count: 50, posX: null, posY: null, bySite: [{ site: "falcao", count: 50 }] }],
  topSearchTerms: [{ label: "desinfetante", count: 32, posX: null, posY: null, bySite: [{ site: "falcao", count: 32 }] }],
  promotionsSummary: [{ label: "promo-boas-vindas · click", count: 18, posX: null, posY: null, bySite: [{ site: "falcao", count: 18 }] }],
};
const getMock = vi.fn(async (_site: unknown, _period: unknown): Promise<AnalyticsDashboard> => DASHBOARD);
const PAGES: AnalyticsPageList = {
  items: [{ site: "falcao", path: "/guias/guia-defesa-operacao-policial", pageviews: 12 }],
  total: 1,
  page: 1,
  pageSize: 20,
};
const pagesMock = vi.fn(async (): Promise<AnalyticsPageList> => PAGES);
vi.mock("../../services/cmsAnalytics.service", () => ({
  getCmsAnalytics: (site: unknown, period: unknown) => getMock(site, period),
  getCmsAnalyticsPages: () => pagesMock(),
}));

afterEach(() => { document.body.innerHTML = ""; clearCmsQueryCache(); getMock.mockClear(); pagesMock.mockClear(); });
async function renderPage() { const container = document.createElement("div"); document.body.appendChild(container); await act(async () => { createRoot(container).render(<CmsAnalyticsPage />); await Promise.resolve(); await Promise.resolve(); }); return container; }

it("mostra números, comparação, funil e rankings para falcao", async () => {
  const container = await renderPage();
  expect(getMock).toHaveBeenLastCalledWith("falcao", expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  expect(container.textContent).toContain("1.234");
  expect(container.textContent).toContain("1m 23s");
  expect(container.textContent).toContain("Visitantes no período");
  expect(container.textContent).toContain("Sessões");
  expect(container.textContent).toContain("Enviou formulário");
  expect(container.textContent).toContain("barra = participação por canal");
  expect(container.textContent).toContain("Falar com advogado @ hero");
  expect(container.textContent).toContain("3,20");
  expect(container.textContent).toContain("/guias/guia-defesa-operacao-policial");
  expect(container.textContent).toContain("Cliques no WhatsApp");
  expect(container.textContent).toContain("Produtos mais adicionados à Lista");
  expect(container.textContent).toContain("Termos mais buscados");
  expect(container.textContent).toContain("Promoções de entrada");
  expect(container.textContent).toContain("prod-agua-sanitaria-2l");
  expect(container.textContent).toContain("desinfetante");
});

it("refaz a busca com período escolhido fixado em falcao", async () => {
  const container = await renderPage();
  expect(getMock).toHaveBeenLastCalledWith("falcao", expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  await act(async () => { [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "7 dias")!.click(); await Promise.resolve(); });
  expect(getMock).toHaveBeenLastCalledWith("falcao", expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
});
