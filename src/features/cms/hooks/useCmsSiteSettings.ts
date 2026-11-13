import { useState } from "react";

import {
  getCmsSiteSettings,
  updateCmsSiteSettings,
  type CmsSiteSettingsUpdate,
} from "../services/cmsSiteSettings.service";
import { writeCmsQuery } from "./cmsQueryCache";
import { settingsKey } from "./cmsQueryKeys";
import { useCmsCachedQuery } from "./useCmsCachedQuery";

export function useCmsSiteSettings() {
  const { data, isLoading, errorMessage } = useCmsCachedQuery(
    settingsKey(),
    getCmsSiteSettings,
    null,
    "Nao foi possivel carregar as configuracoes.",
  );
  const [saved, setSaved] = useState<typeof data>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(payload: CmsSiteSettingsUpdate): Promise<boolean> {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateCmsSiteSettings(payload);
      writeCmsQuery(settingsKey(), updated);
      setSaved(updated);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.";
      setSaveError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    settings: saved ?? data,
    isLoading,
    isSaving,
    errorMessage: saveError ?? errorMessage,
    save,
  };
}
