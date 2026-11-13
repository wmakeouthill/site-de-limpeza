import { useEffect, useState } from "react";
import { fetchCmsSession, peekStoredCmsSession, type CmsSession } from "../services/cmsAuth.service";

export type CmsSessionStatus = "loading" | "authenticated" | "unauthenticated";

interface UseCmsSessionResult {
  status: CmsSessionStatus;
  session: CmsSession | null;
}

function statusFromStored(stored: CmsSession | null | undefined): CmsSessionStatus {
  if (stored) {
    return "authenticated";
  }
  if (stored === null) {
    return "unauthenticated";
  }
  return "loading";
}

export function useCmsSession(): UseCmsSessionResult {
  const stored = peekStoredCmsSession();
  const [status, setStatus] = useState<CmsSessionStatus>(() => statusFromStored(stored));
  const [session, setSession] = useState<CmsSession | null>(() => stored ?? null);

  useEffect(() => {
    let isMounted = true;

    fetchCmsSession()
      .then((result) => {
        if (!isMounted) {
          return;
        }
        setSession(result);
        setStatus(result ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
          setStatus("unauthenticated");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { status, session };
}
