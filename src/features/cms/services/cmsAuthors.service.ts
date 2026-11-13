import { requestCmsJson } from "./cmsApi.service";
import type { CmsAuthor } from "../types/cms.types";

interface CmsAuthorsResponse {
  items: Array<{
    email: string;
    name: string;
    photoUrl: string;
  }>;
}

export async function listCmsAuthors(): Promise<CmsAuthor[]> {
  const response = await requestCmsJson<CmsAuthorsResponse>("/api/cms/authors");
  return (response.items ?? []).map((item) => ({
    email: item.email,
    name: item.name,
    photoUrl: item.photoUrl ?? "",
  }));
}
