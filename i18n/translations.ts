import { cs } from "@/i18n/locales/cs";
import { de } from "@/i18n/locales/de";
import { en } from "@/i18n/locales/en";
import { es } from "@/i18n/locales/es";
import { fr } from "@/i18n/locales/fr";
import { hi } from "@/i18n/locales/hi";
import { it } from "@/i18n/locales/it";
import { ja } from "@/i18n/locales/ja";
import { ko } from "@/i18n/locales/ko";
import { pl } from "@/i18n/locales/pl";
import { pt } from "@/i18n/locales/pt";
import { zh } from "@/i18n/locales/zh";
import { getLocales } from "expo-localization";

export const translations = {
	en,
	cs,
	de,
	es,
	fr,
	hi,
	it,
	ja,
	ko,
	pl,
	pt,
	zh,
} as const;

export type Language = keyof typeof translations;

export type LocalizedText = Partial<Record<Language, string>> & {
	en: string;
};

export const supportedLanguages: Array<{
	code: Language;
	label: string;
	nativeLabel: string;
}> = [
	{ code: "en", label: "English", nativeLabel: "English" },
	{ code: "cs", label: "Czech", nativeLabel: "Čeština" },
	{ code: "de", label: "German", nativeLabel: "Deutsch" },
	{ code: "es", label: "Spanish", nativeLabel: "Español" },
	{ code: "fr", label: "French", nativeLabel: "Français" },
	{ code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
	{ code: "it", label: "Italian", nativeLabel: "Italiano" },
	{ code: "ja", label: "Japanese", nativeLabel: "日本語" },
	{ code: "ko", label: "Korean", nativeLabel: "한국어" },
	{ code: "pl", label: "Polish", nativeLabel: "Polski" },
	{ code: "pt", label: "Portuguese", nativeLabel: "Português" },
	{ code: "zh", label: "Chinese", nativeLabel: "中文" },
];

export const defaultLanguage: Language = "en";

type TranslationParams = Record<string, string | number>;

export type TranslationKey = keyof typeof translations.en;

export function translate(
	language: Language,
	key: TranslationKey,
	params?: TranslationParams,
): string {
	const template: string = translations[language][key] ?? translations.en[key];

	if (!params) {
		return template;
	}

	return Object.entries(params).reduce(
		(result, [paramKey, value]) =>
			result.replaceAll(`{{${paramKey}}}`, String(value)),
		template,
	);
}

export function getLocalizedText(
	value: string | LocalizedText,
	language: Language,
): string {
	if (typeof value === "string") {
		return value;
	}

	return value[language] ?? value[defaultLanguage] ?? "";
}

export function getDeviceLanguage(): Language {
	const languageCode = getLocales()[0]?.languageCode?.toLowerCase();

	if (!languageCode) {
		return defaultLanguage;
	}

	const supportedLanguage = supportedLanguages.find(
		(language) => language.code === languageCode,
	);

	return supportedLanguage?.code ?? defaultLanguage;
}