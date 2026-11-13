import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { CmsAuthContext } from "../../context/CmsAuthContext";
import { prefetchCmsRouteModules, prefetchCmsScreens } from "../../hooks/prefetchCmsScreens";
import { useCmsSession } from "../../hooks/useCmsSession";
import { logoutCms } from "../../services/cmsAuth.service";
import styles from "./CmsAuthGuard.module.css";
import { CmsLoginForm } from "./CmsLoginForm";

interface CmsAuthGuardProps {
  children: ReactNode;
}

export function CmsAuthGuard({ children }: CmsAuthGuardProps) {
  const { status, session } = useCmsSession();

  const logout = useCallback(async () => {
    await logoutCms();
    window.location.assign("/");
  }, []);

  const authValue = useMemo(
    () => (session ? { session, logout } : null),
    [session, logout],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    prefetchCmsScreens();
    prefetchCmsRouteModules();
  }, [status]);

  if (status === "loading") {
    return (
      <main className={styles.screen}>
        <section className={styles.panel}>
          <span className={styles.brand}>FALCÃO LIMPEZA · CMS</span>
          <h1>Carregando acesso</h1>
          <p>Validando sua sessão administrativa.</p>
        </section>
      </main>
    );
  }

  if (status === "unauthenticated" || !session || !authValue) {
    return (
      <main className={styles.screen}>
        <section className={styles.panel}>
          <span className={styles.brand}>FALCÃO LIMPEZA · CMS</span>
          <h1>Acesso administrativo</h1>
          <p>Entre com o e-mail e a senha autorizados para acessar o painel editorial.</p>
          <CmsLoginForm />
        </section>
      </main>
    );
  }

  return <CmsAuthContext.Provider value={authValue}>{children}</CmsAuthContext.Provider>;
}
