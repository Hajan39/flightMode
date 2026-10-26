import { type PluralBase, pluralForms, pluralKey } from "@/components/plural";
import {
  getDeviceLanguage,
  supportedLanguages,
  type TranslationKey,
  translate,
} from "@/i18n/translations";
import { useSettingsStore } from "@/store/useSettingsStore";

export type { Language } from "@/i18n/translations";

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
    /**
     * Plural-aware `t`: picks `base{One,Few,Many,Other}` for `count` and
     * passes `{{count}}` (plus `params`) to it.
     */
    tn: (
      base: PluralBase,
      count: number,
      params?: Record<string, string | number>
    ) =>
      translate(language, pluralKey(language, count, pluralForms(base)), {
        count,
        ...params,
      }),
  };
}
