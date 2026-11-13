import { publicApiBaseUrl } from "@/shared/services/api";
import { getCmsCsrfHeaders, invalidateCmsClientSession, refreshCmsSession } from "./cmsAuth.service";

export interface CmsUploadResult {
  url: string;
  filename: string;
  asset_id?: string;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function uploadCmsImage(file: File): Promise<CmsUploadResult> {
  const filename = file.name.toLowerCase();
  if (filename.endsWith(".svg") || file.type === "image/svg+xml") {
    throw new Error("Arquivos SVG não são permitidos por motivos de segurança.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Arquivo excede o limite máximo permitido de 5MB.");
  }

  let response = await postFile(file);

  if (response.status === 401) {
    const refreshed = await refreshCmsSession();
    if (refreshed) {
      response = await postFile(file);
    }
    if (response.status === 401) {
      invalidateCmsClientSession();
    }
  }

  if (!response.ok) {
    const detail = await getErrorDetail(response);
    throw new Error(detail || `Falha no upload (status ${response.status})`);
  }

  return response.json() as Promise<CmsUploadResult>;
}

function postFile(file: File): Promise<Response> {
  const formData = new FormData();
  formData.append("file", file);

  // Sem header Content-Type: o browser define o boundary do multipart.
  return fetch(`${publicApiBaseUrl}/api/cms/uploads`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...getCmsCsrfHeaders(),
    },
    body: formData,
  });
}

async function getErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as { detail?: string };
    return body.detail ?? "";
  } catch {
    return "";
  }
}
