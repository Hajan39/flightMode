// Mechanical quality guards for every bundled word list (Word Guess, Word
// Search, Word Scramble) in cs / de / en. They target the class of bug found
// in the Hangman pools: diacritics stripped from Czech words, foreign words
// leaking into another language's list, letters the keyboard cannot type,
// secrets whose grid letters drift from the text shown to the player.

import { getKeyboardRows, getWordPool } from "@/games/word-guess/logic";
import { SCRAMBLE_WORDS } from "@/games/word-scramble/words";
import {
  CLASSIC_WORDS,
  SEARCH_WORDS,
  SECRETS,
} from "@/games/word-search/words";

type Lang = "cs" | "de" | "en";
const LANGS: Lang[] = ["cs", "de", "en"];

/** Full uppercase alphabet of each language (no ß: lists use uppercase SS). */
const ALPHABET: Record<Lang, RegExp> = {
  cs: /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/u,
  de: /^[A-ZÄÖÜ]+$/u,
  en: /^[A-Z]+$/,
};

const COMBINING_MARKS = /\p{M}/gu;
const WHITESPACE = /\s+/g;
/** German umlaut spelled out (AE / OE / UE) — UE is fine after A, E, Q (BAUEN, FEUER, QUELLE). */
const UMLAUT_SUBSTITUTE = /AE|OE|(?<![AEQ])UE/;
/** Letters / clusters that do not occur in native Czech words. */
const NON_CZECH = /[QW]|SCH/;

const strip = (word: string) =>
  word.normalize("NFD").replace(COMBINING_MARKS, "").normalize("NFC");
const hasDiacritic = (word: string) => strip(word) !== word;
const len = (word: string) => [...word].length;

function lists(lang: Lang): Record<string, string[]> {
  return {
    "word-guess": getWordPool(lang),
    "word-scramble": SCRAMBLE_WORDS[lang],
    "word-search big": SEARCH_WORDS[lang],
    "word-search classic": CLASSIC_WORDS[lang],
    "word-search secrets": SECRETS[lang].map((s) => s.letters),
  };
}

function corpus(lang: Lang): Set<string> {
  return new Set(Object.values(lists(lang)).flat());
}

/**
 * Genuine minimal pairs that differ only by diacritics. Anything else with an
 * accented and an unaccented spelling is a stripped (misspelled) duplicate.
 */
const LEGIT_DIACRITIC_PAIRS = new Set(["SAGEN/SÄGEN"]);

/**
 * Internationalisms that are correctly spelled in more than one language. A
 * word shared between two languages' lists that is not here is a leak (e.g. a
 * German FLUGHAFEN in the Czech list). Add a word only after checking it is
 * standard spelling in both languages.
 */
const SHARED_CS: ReadonlySet<string> = new Set([
  "DATUM",
  "HOTEL",
  "KABEL",
  "KLIMA",
  "KOALA",
  "MANGO",
  "METRO",
  "MOTOR",
  "PANDA",
  "PIANO",
  "PILOT",
  "PIZZA",
  "RADAR",
  "SAUNA",
  "START",
  "STROM",
  "TAXI",
  "TURBULENCE",
  "VIDEO",
  "ZEBRA",
]);
const SHARED_DE_EN: ReadonlySet<string> = new Set([
  "ATLAS",
  "BRIEF",
  "COCKPIT",
  "FROST",
  "GATE",
  "HOTEL",
  "KOALA",
  "LASER",
  "MANGO",
  "MOTOR",
  "MUSEUM",
  "OLIVE",
  "OTTER",
  "PANDA",
  "PARTY",
  "PASTA",
  "PILOT",
  "PIZZA",
  "RADAR",
  "RADIO",
  "ROUTE",
  "SAUCE",
  "SPORT",
  "STAND",
  "START",
  "STEAK",
  "STILL",
  "TASTE",
  "TAXI",
  "TERMINAL",
  "TICKET",
  "TIGER",
  "TOAST",
  "VILLA",
  "WIND",
  "ZEBRA",
]);

describe.each(LANGS)("word data quality: %s", (lang) => {
  const all = lists(lang);

  test.each(Object.keys(all))(
    `%s: NFC, uppercase, only ${lang} letters, no duplicates`,
    (name) => {
      const words = all[name];
      expect(words.length).toBeGreaterThan(0);
      expect(new Set(words).size).toBe(words.length);
      for (const word of words) {
        expect(word).toBe(word.normalize("NFC"));
        expect(word).toMatch(ALPHABET[lang]);
      }
    }
  );

  test("no word is a diacritic-stripped twin of another word", () => {
    const byStripped = new Map<string, string[]>();
    for (const word of corpus(lang)) {
      const key = strip(word);
      byStripped.set(key, [...(byStripped.get(key) ?? []), word]);
    }
    const twins = [...byStripped.values()]
      .filter(
        (forms) => forms.length > 1 && forms.some((w) => !hasDiacritic(w))
      )
      .map((forms) => [...forms].sort().join("/"))
      .filter((pair) => !LEGIT_DIACRITIC_PAIRS.has(pair));
    expect(twins).toEqual([]);
  });

  test("word-guess: 5 letters, typeable on the keyboard, a year of words", () => {
    const keys = new Set(getKeyboardRows(lang).flat());
    const pool = getWordPool(lang);
    expect(pool.length).toBeGreaterThanOrEqual(366);
    const untypeable = pool.filter(
      (w) => len(w) !== 5 || [...w].some((ch) => !keys.has(ch))
    );
    expect(untypeable).toEqual([]);
  });

  test("word-search: classic words are 5 letters, big-mode words 3–8", () => {
    expect(CLASSIC_WORDS[lang].length).toBeGreaterThanOrEqual(12);
    expect(CLASSIC_WORDS[lang].filter((w) => len(w) !== 5)).toEqual([]);
    expect(SEARCH_WORDS[lang].filter((w) => len(w) < 3 || len(w) > 8)).toEqual(
      []
    );
  });

  test("word-search secrets: letters = text uppercased without spaces", () => {
    for (const { letters, text } of SECRETS[lang]) {
      expect(letters).toBe(
        text.toLocaleUpperCase(lang).replace(WHITESPACE, "").normalize("NFC")
      );
      expect(len(letters)).toBeGreaterThanOrEqual(4);
      expect(len(letters)).toBeLessThanOrEqual(12);
    }
  });

  test("word-scramble: enough words for a game, all scramblable", () => {
    // ROUND_COUNT is 12 in games/word-scramble.
    expect(SCRAMBLE_WORDS[lang].length).toBeGreaterThanOrEqual(12);
    expect(SCRAMBLE_WORDS[lang].filter((w) => len(w) < 4)).toEqual([]);
  });
});

describe("word data quality: language-specific spelling", () => {
  test("Czech lists keep their diacritics (no wholesale ASCII stripping)", () => {
    const words = [...corpus("cs")];
    const ratio = words.filter(hasDiacritic).length / words.length;
    expect(ratio).toBeGreaterThanOrEqual(0.4);
    for (const [name, list] of Object.entries(lists("cs"))) {
      if (list.length >= 10) {
        const share = list.filter(hasDiacritic).length / list.length;
        expect({ name, ok: share >= 0.25 }).toEqual({ name, ok: true });
      }
    }
  });

  test("Czech lists contain no Q / W / SCH (foreign-word leak)", () => {
    expect([...corpus("cs")].filter((w) => NON_CZECH.test(w))).toEqual([]);
  });

  test("German lists use real umlauts, not AE / OE / UE", () => {
    expect([...corpus("de")].filter((w) => UMLAUT_SUBSTITUTE.test(w))).toEqual(
      []
    );
  });

  test("Czech lists share only vetted internationalisms with de / en", () => {
    const de = corpus("de");
    const en = corpus("en");
    const leaks = [...corpus("cs")].filter(
      (w) => (de.has(w) || en.has(w)) && !SHARED_CS.has(w)
    );
    expect(leaks).toEqual([]);
  });

  test("German lists share only vetted loanwords with en", () => {
    const en = corpus("en");
    const leaks = [...corpus("de")].filter(
      (w) => en.has(w) && !SHARED_DE_EN.has(w)
    );
    expect(leaks).toEqual([]);
  });
});
