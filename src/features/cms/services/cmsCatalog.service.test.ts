import { describe, expect, it, vi } from "vitest";
import * as apiService from "./cmsApi.service";
import {
  createCmsProduto,
  deleteCmsProduto,
  listCmsDepartamentos,
  listCmsProdutos,
} from "./cmsCatalog.service";

describe("cmsCatalog.service", () => {
  it("chama GET /api/cms/departamentos e retorna a lista", async () => {
    const mockDept = {
      id: "dept-1",
      nome: "Casa e Pisos",
      slug: "casa-e-pisos",
      icone: "home",
      ordem: 1,
      is_active: true,
    };
    vi.spyOn(apiService, "requestCmsJson").mockResolvedValueOnce([mockDept]);

    const result = await listCmsDepartamentos();
    expect(result).toEqual([mockDept]);
    expect(apiService.requestCmsJson).toHaveBeenCalledWith("/api/cms/departamentos");
  });

  it("chama POST /api/cms/produtos com payload e retorna produto criado", async () => {
    const payload = {
      departamento_id: "dept-1",
      nome: "Desinfetante Floral",
      preco_de: "10.00",
      preco_por: "8.00",
      promo_fim: "2026-10-31",
    };
    const mockCreated = { id: "p1", ...payload, promo_ativa: true, preco_atual: "8.00" };
    vi.spyOn(apiService, "requestCmsJson").mockResolvedValueOnce(mockCreated);

    const result = await createCmsProduto(payload as any);
    expect(result).toEqual(mockCreated);
    expect(apiService.requestCmsJson).toHaveBeenCalledWith("/api/cms/produtos", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("monta query string com parâmetros no listCmsProdutos", async () => {
    vi.spyOn(apiService, "requestCmsJson").mockResolvedValueOnce([]);

    await listCmsProdutos({ departamento_id: "d1", oferta: true, q: "cloro" });
    expect(apiService.requestCmsJson).toHaveBeenCalledWith(
      "/api/cms/produtos?departamento_id=d1&q=cloro&oferta=true"
    );
  });

  it("chama DELETE /api/cms/produtos/{id}", async () => {
    vi.spyOn(apiService, "requestCmsVoid").mockResolvedValueOnce(undefined);

    await deleteCmsProduto("prod-xyz");
    expect(apiService.requestCmsVoid).toHaveBeenCalledWith("/api/cms/produtos/prod-xyz", {
      method: "DELETE",
    });
  });
});
