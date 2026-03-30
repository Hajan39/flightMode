import { useSettingsStore } from "@/store/useSettingsStore";
import {
	getDeviceLanguage,
	supportedLanguages,
	translate,
	type Language,
	type TranslationKey,
} from "@/i18n/translations";

export function useTranslation() {
	const storedLanguage = useSettingsStore((state) => state.language);
	const setLanguage = useSettingsStore((state) => state.setLanguage);
	const resetLanguage = useSettingsStore((state) => state.resetLanguage);
	const systemLanguage = getDeviceLanguage();
	const language = storedLanguage ?? systemLanguage;

	return {
		language,
		systemLanguage,
		storedLanguage,
		languages: supportedLanguages,
		setLanguage,
		resetLanguage,
		t: (key: TranslationKey, params?: Record<string, string | number>) =>
			translate(language, key, params),
	};
}

export type { Language };