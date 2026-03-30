import { cs } from "@/i18n/locales/cs";
import { de } from "@/i18n/locales/de";
import { en } from "@/i18n/locales/en";
import { getLocales } from "expo-localization";

export const translations = {
	en,
	cs,
	de,
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