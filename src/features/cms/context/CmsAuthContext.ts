import { createContext, useContext } from "react";
import type { CmsSession } from "../services/cmsAuth.service";

export interface CmsAuthContextValue {
  session: CmsSession;
  logout: () => Promise<void>;
}

export const CmsAuthContext = createContext<CmsAuthContextValue | null>(null);

export function useCmsAuth(): CmsAuthContextValue {
  const value = useContext(CmsAuthContext);
  if (!value) {
    throw new Error("useCmsAuth deve ser usado dentro de CmsAuthGuard.");
  }
  return value;
}
