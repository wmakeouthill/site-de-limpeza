import { requestCmsJson, requestCmsVoid } from "./cmsApi.service";
import type { CmsPromocao, CmsPromocaoPayload } from "../types/cms.types";

export async function listCmsPromocoes(): Promise<CmsPromocao[]> {
  return await requestCmsJson<CmsPromocao[]>("/api/cms/promocoes");
}

export async function getCmsPromocao(id: string): Promise<CmsPromocao> {
  return await requestCmsJson<CmsPromocao>(`/api/cms/promocoes/${encodeURIComponent(id)}`);
}

export async function createCmsPromocao(payload: CmsPromocaoPayload): Promise<CmsPromocao> {
  return await requestCmsJson<CmsPromocao>("/api/cms/promocoes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCmsPromocao(
  id: string,
  payload: Partial<CmsPromocaoPayload>
): Promise<CmsPromocao> {
  return await requestCmsJson<CmsPromocao>(`/api/cms/promocoes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCmsPromocao(id: string): Promise<void> {
  await requestCmsVoid(`/api/cms/promocoes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
