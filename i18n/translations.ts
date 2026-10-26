import { getLocales } from "expo-localization";
import type { cs } from "@/i18n/locales/cs";
import type { de } from "@/i18n/locales/de";
import { en } from "@/i18n/locales/en";
import type { es } from "@/i18n/locales/es";
import type { fr } from "@/i18n/locales/fr";
import type { hi } from "@/i18n/locales/hi";
import type { it } from "@/i18n/locales/it";
import type { ja } from "@/i18n/locales/ja";
import type { ko } from "@/i18n/locales/ko";
import type { pl } from "@/i18n/locales/pl";
import type { pt } from "@/i18n/locales/pt";
import type { zh } from "@/i18n/locales/zh";

interface LocaleTables {
  cs: typeof cs;
  de: typeof de;
  en: typeof en;
  es: typeof es;
  fr: typeof fr;
  hi: typeof hi;
  it: typeof it;
  ja: typeof ja;
  ko: typeof ko;
  pl: typeof pl;
  pt: typeof pt;
  zh: typeof zh;
}

export type Language = keyof LocaleTables;

// Only English (the fallback for every missing key) is evaluated at startup.
// Other locales are required on first use: Metro keeps each module's factory
// un-run until its first require(), so the 11 unused ~1.5k-key tables are
// never evaluated (Hermes also only parses them lazily).
const loaders: { [L in Exclude<Language, "en">]: () => LocaleTables[L] } = {
  cs: () => require("@/i18n/locales/cs").cs,
  de: () => require("@/i18n/locales/de").de,
  es: () => require("@/i18n/locales/es").es,
  fr: () => require("@/i18n/locales/fr").fr,
  hi: () => require("@/i18n/locales/hi").hi,
  it: () => require("@/i18n/locales/it").it,
  ja: () => require("@/i18n/locales/ja").ja,
  ko: () => require("@/i18n/locales/ko").ko,
  pl: () => require("@/i18n/locales/pl").pl,
  pt: () => require("@/i18n/locales/pt").pt,
  zh: () => require("@/i18n/locales/zh").zh,
};

const cache: Partial<LocaleTables> = { en };

export function getLocaleTable<L extends Language>(
  language: L
): LocaleTables[L] {
  const cached = cache[language];
  if (cached) {
    return cached as LocaleTables[L];
  }
  const loader = loaders[language as Exclude<Language, "en">];
  const table = (loader ? loader() : en) as LocaleTables[L];
  cache[language] = table;
  return table;
}

/**
 * All locale tables, keyed by language. Each property is a lazy getter, so
 * `Object.keys(translations)` is cheap and a table is only loaded when read.
 */
export const translations: Readonly<LocaleTables> = {
  get cs() {
    return getLocaleTable("cs");
  },
  get de() {
    return getLocaleTable("de");
  },
  en,
  get es() {
    return getLocaleTable("es");
  },
  get fr() {
    return getLocaleTable("fr");
  },
  get hi() {
    return getLocaleTable("hi");
  },
  get it() {
    return getLocaleTable("it");
  },
  get ja() {
    return getLocaleTable("ja");
  },
  get ko() {
    return getLocaleTable("ko");
  },
  get pl() {
    return getLocaleTable("pl");
  },
  get pt() {
    return getLocaleTable("pt");
  },
  get zh() {
    return getLocaleTable("zh");
  },
};

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

export type TranslationKey = keyof typeof en;

export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslationParams
): string {
  const languageTable = getLocaleTable(language) as Partial<
    Record<TranslationKey, string>
  >;
  const template: string = languageTable[key] ?? en[key];

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [paramKey, value]) =>
      result.replaceAll(`{{${paramKey}}}`, String(value)),
    template
  );
}

export function getLocalizedText(
  value: string | LocalizedText,
  language: Language
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
    (language) => language.code === languageCode
  );

  return supportedLanguage?.code ?? defaultLanguage;
}
