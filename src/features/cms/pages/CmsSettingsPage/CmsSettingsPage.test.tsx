// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CmsSettingsPage } from "./CmsSettingsPage";
import { clearCmsQueryCache } from "../../hooks/cmsQueryCache";
import type { CmsSiteSettings } from "../../services/cmsSiteSettings.service";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../../components/CmsAuthGuard", () => ({
  CmsAuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/CmsShell", () => ({
  CmsShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/CampaignSourceLinksSettings/CampaignSourceLinksSettings", () => ({
  CampaignSourceLinksSettings: () => <div data-testid="campaign-links-mock" />,
}));

const mockSettings: CmsSiteSettings = {
  lojaNome: "Falcão Limpeza",
  razaoSocial: "Falcão Comércio LTDA",
  cnpj: "12.345.678/0001-90",
  whatsappNumero: "5521999999999",
  telefoneExibicao: "(21) 99999-9999",
  endereco: "Estrada de Jacarepaguá, 5171",
  bairroCidade: "Anil, Rio de Janeiro - RJ",
  referenciaEndereco: "pertinho de Rio das Pedras",
  mapsUrl: "https://maps.google.com/?q=Falcao",
  horarios: [],
  horarioObs: "Feriados: 8h às 13h",
  pagamento: "Dinheiro, Pix, cartões",
  chavePix: "falcao@pix.com.br",
  bairrosEntrega: ["Anil", "Rio das Pedras"],
  prazoSeparacao: "Separado em ~30 min",
  instagramUrl: "https://instagram.com/falcao",
  articlesEnabled: true,
  guidesEnabled: true,
};

const getSettingsMock = vi.fn(async (): Promise<CmsSiteSettings> => mockSettings);
const updateSettingsMock = vi.fn(async (payload: unknown) => ({
  ...mockSettings,
  ...(payload as Record<string, unknown>),
}));

vi.mock("../../services/cmsSiteSettings.service", () => ({
  getCmsSiteSettings: () => getSettingsMock(),
  updateCmsSiteSettings: (payload: unknown) => updateSettingsMock(payload),
}));

let container: HTMLDivElement;

function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  clearCmsQueryCache();
  container = document.createElement("div");
  document.body.appendChild(container);
  getSettingsMock.mockClear();
  updateSettingsMock.mockClear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

it("renderiza os campos de dados da loja carregados do serviço", async () => {
  const root = createRoot(container);
  await act(async () => {
    root.render(<CmsSettingsPage />);
  });

  const lojaNomeInput = container.querySelector("#lojaNome") as HTMLInputElement;
  const whatsappInput = container.querySelector("#whatsappNumero") as HTMLInputElement;
  const enderecoInput = container.querySelector("#endereco") as HTMLInputElement;

  expect(lojaNomeInput).not.toBeNull();
  expect(lojaNomeInput.value).toBe("Falcão Limpeza");
  expect(whatsappInput.value).toBe("5521999999999");
  expect(enderecoInput.value).toBe("Estrada de Jacarepaguá, 5171");

  // Bairros tags
  expect(container.textContent).toContain("Anil");
  expect(container.textContent).toContain("Rio das Pedras");
});

it("permite adicionar e remover bairros de entrega", async () => {
  const root = createRoot(container);
  await act(async () => {
    root.render(<CmsSettingsPage />);
  });

  const bairroInput = container.querySelector('input[placeholder*="Ex: Rio das Pedras"]') as HTMLInputElement;
  const addBtn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Adicionar bairro"),
  );

  expect(bairroInput).not.toBeNull();
  expect(addBtn).not.toBeNull();

  // Adicionar novo bairro "Gardênia Azul"
  await act(async () => {
    setInputValue(bairroInput, "Gardênia Azul");
  });
  await act(async () => {
    addBtn?.click();
  });

  const tagsContainer = container.querySelector('[class*="tagsContainer"]');
  expect(tagsContainer?.textContent).toContain("Gardênia Azul");

  // Remover bairro "Anil"
  const removeAnilBtn = container.querySelector('button[aria-label="Remover Anil"]') as HTMLButtonElement;
  expect(removeAnilBtn).not.toBeNull();

  await act(async () => {
    removeAnilBtn.click();
  });

  expect(tagsContainer?.textContent).not.toContain("Anil");
  expect(tagsContainer?.textContent).toContain("Rio das Pedras");
});

it("bloqueia salvamento de WhatsApp inválido com mensagem de validação", async () => {
  const root = createRoot(container);
  await act(async () => {
    root.render(<CmsSettingsPage />);
  });

  const whatsappInput = container.querySelector("#whatsappNumero") as HTMLInputElement;
  const form = container.querySelector("form") as HTMLFormElement;

  // WhatsApp sem DDI 55
  await act(async () => {
    setInputValue(whatsappInput, "21999998888");
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(container.textContent).toContain("WhatsApp deve conter DDI 55");
  expect(updateSettingsMock).not.toHaveBeenCalled();
});

it("envia payload completo ao salvar com dados válidos e mostra sucesso", async () => {
  const root = createRoot(container);
  await act(async () => {
    root.render(<CmsSettingsPage />);
  });

  const lojaNomeInput = container.querySelector("#lojaNome") as HTMLInputElement;
  const form = container.querySelector("form") as HTMLFormElement;

  await act(async () => {
    setInputValue(lojaNomeInput, "Falcão Limpeza Matriz");
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  expect(updateSettingsMock).toHaveBeenCalledTimes(1);
  const calledPayload = updateSettingsMock.mock.calls[0][0] as Record<string, unknown>;
  expect(calledPayload.loja_nome).toBe("Falcão Limpeza Matriz");
  expect(calledPayload.whatsapp_numero).toBe("5521999999999");
  expect(container.textContent).toContain("Configurações da loja salvas com sucesso.");
});
