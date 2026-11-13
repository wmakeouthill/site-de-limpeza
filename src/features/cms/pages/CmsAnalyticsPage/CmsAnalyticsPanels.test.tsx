// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { PagesCard, RankingCard } from "./CmsAnalyticsPanels";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("mostra na página somente os canais que tiveram visualizações reais", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <PagesCard
        rows={[{ label: "/artigos/agentes", count: 12, posX: null, posY: null, bySite: [{ site: "talimpo", count: 12 }] }]}
      />,
    );
  });

  expect(container.textContent).toContain("Falcão");
});

it("mostra campanhas, criativos e link no detalhe da origem", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <RankingCard
        title="Origens de tráfego"
        unit="sessões"
        showCampaigns
        rows={[{
          label: "Instagram / M\u00eddia paga",
          count: 2,
          posX: null,
          posY: null,
          bySite: [{ site: "talimpo", count: 2 }],
          campaigns: [{
            label: "promo-verao-leads-teste-01",
            count: 2,
            creatives: [{
              label: "reel-agosto-01",
              count: 2,
              placement: "reels",
              link: {
                identifier: "reel-agosto-01",
                title: "Reel Agentes IA",
                sourceUrl: "https://www.instagram.com/reel/ABC123/",
                thumbnailUrl: "",
                redirectUrl: "",
              },
            }],
          }],
        }]}
      />,
    );
  });

  expect(container.textContent).toContain("promo-verao-leads-teste-01");
  await act(async () => {
    container.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
  expect(container.textContent).toContain("reel-agosto-01");
  expect(container.querySelector('a[href="https://www.instagram.com/reel/ABC123/"]')).not.toBeNull();
});

it("expõe no tooltip os valores brutos de uma origem normalizada", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(
      <RankingCard
        title="Origens de tráfego"
        unit="sessões"
        rows={[{
          label: "Instagram",
          count: 8,
          rawLabels: [{ label: "ig", count: 7 }, { label: "l.instagram.com", count: 1 }],
          posX: null,
          posY: null,
          bySite: [{ site: "talimpo", count: 8 }],
        }]}
      />,
    );
  });

  expect(container.textContent).toContain("Valores capturados");
  expect(container.textContent).toContain("ig");
  expect(container.textContent).toContain("l.instagram.com");
});
