// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CmsLoginForm } from "./CmsLoginForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar no CMS" }));
}

it("mostra a mensagem genérica quando a senha é recusada", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  render(<CmsLoginForm />);

  fillAndSubmit("socio@falcaolimpeza.adv.br", "senha-errada-123");

  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "E-mail ou senha inválidos.",
  );
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/\/api\/cms\/auth\/login$/);
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({
    email: "socio@falcaolimpeza.adv.br",
    password: "senha-errada-123",
  });
});

it("recarrega a página quando o login dá certo", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  render(<CmsLoginForm />);

  fillAndSubmit("socio@falcaolimpeza.adv.br", "senha-correta-123");

  await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
  expect(screen.queryByRole("alert")).toBeNull();
});
