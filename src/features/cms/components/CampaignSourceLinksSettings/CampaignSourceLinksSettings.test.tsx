// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { CampaignSourceLinksSettings } from "./CampaignSourceLinksSettings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const listMock = vi.fn(async () => []);
const saveMock = vi.fn(async (identifier: string, payload: { title: string; sourceUrl: string; thumbnailUrl: string; redirectUrl: string }) => ({ identifier, ...payload }));
vi.mock("../../services/cmsCampaignLinks.service", () => ({
  listCmsCampaignLinks: () => listMock(),
  upsertCmsCampaignLink: (identifier: string, payload: { title: string; sourceUrl: string; thumbnailUrl: string; redirectUrl: string }) => saveMock(identifier, payload),
  deleteCmsCampaignLink: vi.fn(),
}));

afterEach(() => {
  document.body.innerHTML = "";
  listMock.mockClear();
  saveMock.mockClear();
});

it("cadastra uma origem de campanha por identificador", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(<CampaignSourceLinksSettings />);
    await Promise.resolve();
  });

  const inputs = [...container.querySelectorAll<HTMLInputElement>("input")];
  const values = ["reel-agosto-01", "Reel: agentes de IA", "https://www.instagram.com/reel/ABC123/", "https://cdn.example.com/reel.jpg", ""];
  await act(async () => {
    inputs.forEach((input, index) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, values[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    container.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    await Promise.resolve();
  });

  expect(saveMock).toHaveBeenCalledWith("reel-agosto-01", {
    title: "Reel: agentes de IA",
    sourceUrl: "https://www.instagram.com/reel/ABC123/",
    thumbnailUrl: "https://cdn.example.com/reel.jpg",
    redirectUrl: "",
  });
});

it("cadastra a URL curta usada como fallback de atribuição", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  await act(async () => {
    createRoot(container).render(<CampaignSourceLinksSettings />);
    await Promise.resolve();
  });

  const inputs = [...container.querySelectorAll<HTMLInputElement>("input")];
  const values = ["reel-case-01", "Case Limpeza Industrial", "https://www.instagram.com/reel/ABC123/", "", "https://bit.ly/exemplo"];
  await act(async () => {
    inputs.forEach((input, index) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, values[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    container.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    await Promise.resolve();
  });

  expect(saveMock).toHaveBeenCalledWith("reel-case-01", {
    title: "Case Limpeza Industrial",
    sourceUrl: "https://www.instagram.com/reel/ABC123/",
    thumbnailUrl: "",
    redirectUrl: "https://bit.ly/exemplo",
  });
});
