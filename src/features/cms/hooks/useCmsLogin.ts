import { useCallback, useState, type FormEvent } from "react";
import { loginCms } from "../services/cmsAuth.service";

interface UseCmsLoginResult {
  error: string | null;
  isSubmitting: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useCmsLogin(): UseCmsLoginResult {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError(null);
    try {
      const message = await loginCms(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
      if (message === null) {
        // Recarrega para o guard ler a sessão nova dos cookies.
        window.location.reload();
        return;
      }
      setError(message);
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
    }
    setIsSubmitting(false);
  }, []);

  return { error, isSubmitting, submit };
}
