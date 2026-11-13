import { useCallback, useEffect, useRef, useState } from "react";

import { peekCmsQuery, readCmsQuery } from "./cmsQueryCache";

export function useCmsCachedQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  initial: T,
  errorText: string,
  options?: { keepPreviousData?: boolean },
) {
  const keepPreviousData = options?.keepPreviousData ?? false;
  const cached = peekCmsQuery<T>(cacheKey);
  const [data, setData] = useState<T>(cached ?? initial);
  const [hasData, setHasData] = useState(cached !== undefined);
  const [isFetching, setIsFetching] = useState(cached === undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => {
    setIsFetching(true);
    setErrorMessage(null);
    void readCmsQuery(cacheKey, () => fetcherRef.current(), true)
      .then((result) => {
        setData(result);
        setHasData(true);
      })
      .catch(() => {
        setErrorMessage(errorText);
      })
      .finally(() => {
        setIsFetching(false);
      });
  }, [cacheKey, errorText]);

  useEffect(() => {
    let isMounted = true;
    const hit = peekCmsQuery<T>(cacheKey);
    if (hit !== undefined) {
      setData(hit);
      setHasData(true);
      setIsFetching(false);
      setErrorMessage(null);
      return () => {
        isMounted = false;
      };
    }

    setIsFetching(true);
    setErrorMessage(null);
    void readCmsQuery(cacheKey, () => fetcherRef.current())
      .then((result) => {
        if (!isMounted) {
          return;
        }
        setData(result);
        setHasData(true);
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage(errorText);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsFetching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cacheKey, errorText]);

  return {
    data: cached ?? data,
    isLoading: cached === undefined && (!keepPreviousData || !hasData),
    isFetching,
    errorMessage,
    refetch,
  };
}
