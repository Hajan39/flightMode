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
