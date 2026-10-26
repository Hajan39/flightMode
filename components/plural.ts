import type { Language, TranslationKey } from "@/i18n/translations";

export type PluralCategory = "one" | "few" | "many" | "other";

/** Keys for each plural form; `few` / `many` fall back to `other`. */
export interface PluralKeys {
  few?: TranslationKey;
  many?: TranslationKey;
  one: TranslationKey;
  other: TranslationKey;
}

const ONE_FOR_ZERO_AND_ONE = new Set<Language>(["fr", "hi", "pt"]);
const NO_PLURALS = new Set<Language>(["ja", "ko", "zh"]);

/** Hand-written CLDR integer rules for the 12 app languages. */
export function fallbackPluralCategory(
  language: Language,
  count: number
): PluralCategory {
  const n = Math.abs(Math.trunc(count));
  if (NO_PLURALS.has(language)) {
    return "other";
  }
  if (ONE_FOR_ZERO_AND_ONE.has(language)) {
    return n <= 1 ? "one" : "other";
  }
  if (language === "cs") {
    if (n === 1) {
      return "one";
    }
    return n >= 2 && n <= 4 ? "few" : "other";
  }
  if (language === "pl") {
    if (n === 1) {
      return "one";
    }
    const mod10 = n % 10;
    const mod100 = n % 100;
    return mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
      ? "few"
      : "many";
  }
  return n === 1 ? "one" : "other";
}

const rulesCache = new Map<Language, Intl.PluralRules | null>();

function intlRules(language: Language): Intl.PluralRules | null {
  if (rulesCache.has(language)) {
    return rulesCache.get(language) ?? null;
  }
  let rules: Intl.PluralRules | null = null;
  try {
    // Hermes builds may ship without Intl.PluralRules.
    if (typeof Intl !== "undefined" && typeof Intl.PluralRules === "function") {
      rules = new Intl.PluralRules(language);
    }
  } catch {
    rules = null;
  }
  rulesCache.set(language, rules);
  return rules;
}

/** CLDR plural category for `count` (Intl.PluralRules, hand rules as fallback). */
export function getPluralCategory(
  language: Language,
  count: number
): PluralCategory {
  const rules = intlRules(language);
  if (rules) {
    const category = rules.select(count);
    // None of the app languages uses zero/two for integers.
    return category === "one" || category === "few" || category === "many"
      ? category
      : "other";
  }
  return fallbackPluralCategory(language, count);
}

/** The key matching `count`'s plural form in `language`. */
export function pluralKey(
  language: Language,
  count: number,
  keys: PluralKeys
): TranslationKey {
  const category = getPluralCategory(language, count);
  if (category === "one") {
    return keys.one;
  }
  if (category === "few") {
    return keys.few ?? keys.other;
  }
  if (category === "many") {
    return keys.many ?? keys.other;
  }
  return keys.other;
}
