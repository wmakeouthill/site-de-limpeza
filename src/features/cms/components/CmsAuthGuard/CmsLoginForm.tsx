import { useCmsLogin } from "../../hooks/useCmsLogin";
import styles from "./CmsAuthGuard.module.css";

export function CmsLoginForm() {
  const { error, isSubmitting, submit } = useCmsLogin();

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span>E-mail</span>
        <input name="email" type="email" autoComplete="username" required maxLength={320} />
      </label>
      <label className={styles.field}>
        <span>Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar no CMS"}
      </button>
    </form>
  );
}
