import { useCallback, useMemo } from "react";

import { listCmsContent } from "../services/cmsContent.service";
import type {
  CmsContentStatus,
  CmsContentType,
  CmsSiteScope,
} from "../types/cms.types";
import { invalidateCmsQueries } from "./cmsQueryCache";
import { contentKey } from "./cmsQueryKeys";
import { useCmsCachedQuery } from "./useCmsCachedQuery";

interface UseCmsContentParams {
  contentType: CmsContentType;
  status?: CmsContentStatus;
  searchTerm: string;
  site?: CmsSiteScope;
}

const EMPTY = { items: [], total: 0 };

export function useCmsContent({ contentType, status, searchTerm, site }: UseCmsContentParams) {
  const cacheKey = contentKey(contentType, status, site);
  const fetcher = useCallback(
    () => listCmsContent({ contentType, status, site }),
    [contentType, status, site],
  );
  const { data, isLoading, errorMessage, refetch: refetchCurrent } = useCmsCachedQuery(
    cacheKey,
    fetcher,
    EMPTY,
    "Nao foi possivel carregar os conteudos.",
  );

  const refetch = useCallback(() => {
    invalidateCmsQueries("content:", cacheKey);
    refetchCurrent();
  }, [cacheKey, refetchCurrent]);

  const filteredItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    if (!normalizedSearchTerm) {
      return data.items;
    }

    return data.items.filter((item) =>
      [item.title, item.slug, item.detailLabel, item.excerpt]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchTerm),
    );
  }, [data.items, searchTerm]);

  return {
    items: filteredItems,
    total: data.items.length,
    isLoading,
    errorMessage,
    refetch,
  };
}
