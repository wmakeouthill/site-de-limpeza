import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";
import type {
  CmsDepartamento,
  CmsDepartamentoPayload,
  CmsKit,
  CmsKitPayload,
  CmsProduto,
  CmsProdutoPayload,
} from "../types/cms.types";

// =============================================================================
// DEPARTAMENTOS
// =============================================================================

export async function listCmsDepartamentos(): Promise<CmsDepartamento[]> {
  return await requestCmsJson<CmsDepartamento[]>("/api/cms/departamentos");
}

export async function createCmsDepartamento(
  payload: CmsDepartamentoPayload
): Promise<CmsDepartamento> {
  return await requestCmsJson<CmsDepartamento>("/api/cms/departamentos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCmsDepartamento(
  departamentoId: string,
  payload: Partial<CmsDepartamentoPayload>
): Promise<CmsDepartamento> {
  return await requestCmsJson<CmsDepartamento>(
    `/api/cms/departamentos/${encodeURIComponent(departamentoId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCmsDepartamento(departamentoId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/departamentos/${encodeURIComponent(departamentoId)}`, {
    method: "DELETE",
  });
}

// =============================================================================
// PRODUTOS
// =============================================================================

export interface ListCmsProdutosParams {
  departamento_id?: string;
  q?: string;
  oferta?: boolean;
  embalagem_grande?: boolean;
  marca?: string;
  ordem?: string;
}

export async function listCmsProdutos(
  params?: ListCmsProdutosParams
): Promise<CmsProduto[]> {
  const query = new URLSearchParams();
  if (params?.departamento_id) query.set("departamento_id", params.departamento_id);
  if (params?.q) query.set("q", params.q);
  if (params?.oferta) query.set("oferta", "true");
  if (params?.embalagem_grande) query.set("embalagem_grande", "true");
  if (params?.marca) query.set("marca", params.marca);
  if (params?.ordem) query.set("ordem", params.ordem);

  const qs = query.toString();
  const endpoint = qs ? `/api/cms/produtos?${qs}` : "/api/cms/produtos";
  return await requestCmsJson<CmsProduto[]>(endpoint);
}

export async function getCmsProduto(produtoId: string): Promise<CmsProduto> {
  return await requestCmsJson<CmsProduto>(
    `/api/cms/produtos/${encodeURIComponent(produtoId)}`
  );
}

export async function createCmsProduto(
  payload: CmsProdutoPayload
): Promise<CmsProduto> {
  return await requestCmsJson<CmsProduto>("/api/cms/produtos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCmsProduto(
  produtoId: string,
  payload: Partial<CmsProdutoPayload>
): Promise<CmsProduto> {
  return await requestCmsJson<CmsProduto>(
    `/api/cms/produtos/${encodeURIComponent(produtoId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCmsProduto(produtoId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/produtos/${encodeURIComponent(produtoId)}`, {
    method: "DELETE",
  });
}

// =============================================================================
// KITS
// =============================================================================

export async function listCmsKits(publico?: string): Promise<CmsKit[]> {
  const endpoint = publico
    ? `/api/cms/kits?publico=${encodeURIComponent(publico)}`
    : "/api/cms/kits";
  return await requestCmsJson<CmsKit[]>(endpoint);
}

export async function createCmsKit(payload: CmsKitPayload): Promise<CmsKit> {
  return await requestCmsJson<CmsKit>("/api/cms/kits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteCmsKit(kitId: string): Promise<void> {
  await requestCmsVoid(`/api/cms/kits/${encodeURIComponent(kitId)}`, {
    method: "DELETE",
  });
}
