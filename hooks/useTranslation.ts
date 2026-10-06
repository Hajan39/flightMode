import {
  getDeviceLanguage,
  type Language,
  supportedLanguages,
  type TranslationKey,
  translate,
} from "@/i18n/translations";
import { useSettingsStore } from "@/store/useSettingsStore";

export function useTranslation() {
  const storedLanguage = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const resetLanguage = useSettingsStore((state) => state.resetLanguage);
  const systemLanguage = getDeviceLanguage();
  const language = storedLanguage ?? systemLanguage;

  return {
    language,
    languages: supportedLanguages,
    resetLanguage,
    setLanguage,
    storedLanguage,
    systemLanguage,
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(language, key, params),
  };
}

export type { Language };
