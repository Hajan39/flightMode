import {
  baseLetter,
  countWrong,
  isRevealed,
  isSolved,
  wordHasLetter,
} from "@/games/duel-hangman/logic";
import { getWordPool } from "@/games/duel-hangman/words";

const A_TO_Z = /^[A-Z]$/;
const LANGUAGES = [
  "cs",
  "de",
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "zh",
] as const;

describe("hangman letter matching (diacritics)", () => {
  test("base letter strips accents", () => {
    expect(baseLetter("Ř")).toBe("R");
    expect(baseLetter("Ě")).toBe("E");
    expect(baseLetter("Ů")).toBe("U");
    expect(baseLetter("Ä")).toBe("A");
    expect(baseLetter("A")).toBe("A");
  });

  test("a plain key reveals every accented form", () => {
    const guessed = new Set(["R", "E"]);
    expect(isRevealed("Ř", guessed)).toBe(true);
    expect(isRevealed("Ě", guessed)).toBe(true);
    expect(isRevealed("Í", guessed)).toBe(false);
    expect(wordHasLetter("PŘISTÁNÍ", "R")).toBe(true);
    expect(wordHasLetter("PŘISTÁNÍ", "E")).toBe(false);
  });

  test("solve and wrong-count use base letters", () => {
    const word = "LOĎ";
    expect(isSolved(word, new Set(["L", "O"]))).toBe(false);
    expect(isSolved(word, new Set(["L", "O", "D"]))).toBe(true);
    expect(countWrong(word, new Set(["L", "X", "Y"]))).toBe(2);
    expect(isSolved("", new Set(["A"]))).toBe(false);
  });
});

describe("hangman word pools", () => {
  test.each(LANGUAGES)(
    "%s: every word is solvable on the A–Z keyboard",
    (lang) => {
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const pool = getWordPool(lang, difficulty);
        expect(pool.length).toBeGreaterThan(10);
        for (const word of pool) {
          expect(word).toBe(word.toUpperCase());
          for (const ch of word) {
            expect(baseLetter(ch)).toMatch(A_TO_Z);
          }
        }
      }
    }
  );

  const TIER_LENGTH = {
    easy: [3, 4],
    hard: [7, Number.POSITIVE_INFINITY],
    medium: [5, 6],
  } as const;

  test.each(LANGUAGES)(
    "%s: tier lengths, pool sizes and no duplicates",
    (lang) => {
      const seen = new Set<string>();
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const pool = getWordPool(lang, difficulty);
        const [min, max] = TIER_LENGTH[difficulty];
        expect(pool.length).toBeGreaterThanOrEqual(20);
        expect(pool.length).toBeLessThanOrEqual(30);
        for (const word of pool) {
          const { length } = [...word];
          expect(length).toBeGreaterThanOrEqual(min);
          expect(length).toBeLessThanOrEqual(max);
          expect(seen.has(word)).toBe(false);
          seen.add(word);
        }
      }
    }
  );

  const JUNK: Record<string, string[]> = {
    de: ["BOG", "RAN", "ART", "ORT", "HOHENMESSER", "RUMPFWERK", "GLEISE"],
    en: ["OSCAR", "INDIA", "WINGS", "JETLAG", "LUNAR"],
    es: ["TOR", "RUM", "AVIO", "AUTOPILOT", "AVION", "TRIPULACION"],
    fr: ["NET", "VIS", "DARD", "ONDES", "DECOLLAGE", "AEROPORT", "HOTEL"],
    it: ["ORT", "REM", "ARC", "ETA", "URTO", "ROTA", "VIRATA"],
    pl: ["LAD", "BEG", "SOL", "RAN", "MASZ", "WZNOS", "KLAPY", "LADOWANIE"],
    pt: ["EIX", "AXE", "ARC", "VIS", "CABINA", "COMBUSTIVEL", "BUSSOLA"],
  };

  test.each(Object.keys(JUNK))("%s: old junk stays out", (lang) => {
    const all = (["easy", "medium", "hard"] as const).flatMap((d) =>
      getWordPool(lang as (typeof LANGUAGES)[number], d)
    );
    for (const junk of JUNK[lang]) {
      expect(all).not.toContain(junk);
    }
    // NATO-alphabet filler is gone everywhere.
    for (const filler of ["ALPHA", "BRAVO", "DELTA", "TANGO"]) {
      expect(all).not.toContain(filler);
    }
  });

  test("CJK and Hindi share the English pool", () => {
    for (const lang of ["hi", "ja", "ko", "zh"] as const) {
      expect(getWordPool(lang, "hard")).toBe(getWordPool("en", "hard"));
    }
  });

  test("Czech words keep their real spelling", () => {
    const all = (["easy", "medium", "hard"] as const).flatMap((d) =>
      getWordPool("cs", d)
    );
    expect(all).toContain("PŘISTÁNÍ");
    expect(all).not.toContain("PRISTANI");
    // Fragments from the old ASCII-only list must not come back.
    for (const junk of ["PLN", "OSOV", "TYRL", "BEH", "VZLETOVA"]) {
      expect(all).not.toContain(junk);
    }
  });
});
