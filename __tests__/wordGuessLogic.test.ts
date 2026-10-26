import {
  checkGuess,
  getDayOfYear,
  getKeyboardRows,
  getWordPool,
  KEY_GAP,
  KEY_HEIGHT,
  KEYBOARD_PADDING,
  keyboardRowWidth,
  keyMetrics,
  mergeKeyboard,
  WORD_POOL,
  type WordGuessLanguage,
} from "@/games/word-guess/logic";

const FIVE_UPPERCASE_LETTERS = /^[A-Z]{5}$/;

describe("word-guess checkGuess", () => {
  test("all correct for an exact match", () => {
    expect(checkGuess("PILOT", "PILOT")).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  test("all absent when no letters overlap", () => {
    expect(checkGuess("BXKWZ", "PILOT")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
  });

  test("double letter in guess but single in target: only one is marked", () => {
    // target PILOT has one P (at 0) and one L (at 2), no A/E.
    // guess APPLE: A absent, first P present (matches P), second P absent
    // (P already consumed), L present, E absent.
    expect(checkGuess("APPLE", "PILOT")).toEqual([
      "absent",
      "present",
      "absent",
      "present",
      "absent",
    ]);
  });

  test("green is consumed before yellow (repeated letter)", () => {
    // target LEVEL, guess EAGER: the E at index 3 is green; the leading E
    // then matches the remaining E as yellow; second target L stays unused.
    expect(checkGuess("EAGER", "LEVEL")).toEqual([
      "present",
      "absent",
      "absent",
      "correct",
      "absent",
    ]);
  });

  test("a letter already used as green is not reused as yellow elsewhere", () => {
    // target ABCDE has a single A, used by the green at index 0 — the second
    // guessed A must be absent, not present.
    expect(checkGuess("AAXXX", "ABCDE")).toEqual([
      "correct",
      "absent",
      "absent",
      "absent",
      "absent",
    ]);
    // Green later in the word still wins over an earlier duplicate.
    expect(checkGuess("XAXXA", "BCDEA")).toEqual([
      "absent",
      "absent",
      "absent",
      "absent",
      "correct",
    ]);
  });

  test("mix of correct, present and absent", () => {
    // target CRANE, guess CANOE:
    // C green; A present (target has A at 2); N present (target N at 3);
    // O absent; E green.
    expect(checkGuess("CANOE", "CRANE")).toEqual([
      "correct",
      "present",
      "present",
      "absent",
      "correct",
    ]);
  });
});

describe("word-guess WORD_POOL", () => {
  test("every word is exactly 5 uppercase A–Z letters", () => {
    for (const w of WORD_POOL) {
      expect(w).toMatch(FIVE_UPPERCASE_LETTERS);
    }
  });

  test("pool is non-empty and de-duplicated", () => {
    expect(WORD_POOL.length).toBeGreaterThanOrEqual(366);
    expect(new Set(WORD_POOL).size).toBe(WORD_POOL.length);
  });

  test("getDayOfYear returns a value within the year", () => {
    const d = getDayOfYear();
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(366);
  });
});

describe.each(["cs", "de", "en"] as WordGuessLanguage[])(
  "word-guess %s pool",
  (language) => {
    const pool = getWordPool(language);
    const keys = new Set(getKeyboardRows(language).flat());

    test("covers a year of daily words without repeats", () => {
      expect(pool.length).toBeGreaterThanOrEqual(366);
      expect(new Set(pool).size).toBe(pool.length);
    });

    test("every word is 5 letters typeable on the keyboard", () => {
      for (const word of pool) {
        expect(word).toBe(word.normalize("NFC"));
        expect(word.length).toBe(5);
        for (const letter of word) {
          expect(keys.has(letter)).toBe(true);
        }
      }
    });
  }
);

describe("word-guess mergeKeyboard", () => {
  test("keys only ever upgrade: absent < present < correct", () => {
    let keys = mergeKeyboard(
      {},
      ["absent", "present", "absent", "absent", "correct"],
      ["A", "B", "C", "D", "E"]
    );
    expect(keys).toEqual({
      A: "absent",
      B: "present",
      C: "absent",
      D: "absent",
      E: "correct",
    });
    keys = mergeKeyboard(
      keys,
      ["present", "correct", "absent", "absent", "absent"],
      ["A", "B", "X", "Y", "E"]
    );
    expect(keys.A).toBe("present"); // absent → present
    expect(keys.B).toBe("correct"); // present → correct
    expect(keys.E).toBe("correct"); // never downgraded
    expect(keys.X).toBe("absent");
  });

  test("does not mutate the previous keyboard state", () => {
    const before = { A: "absent" as const };
    mergeKeyboard(before, ["correct"], ["A"]);
    expect(before).toEqual({ A: "absent" });
  });
});

describe("keyboard layout", () => {
  const MIN_TARGET = 44;

  it.each([320, 360, 390, 430])(
    "every keyboard row fits a %i dp wide screen",
    (width) => {
      const m = keyMetrics(width);
      for (const lang of ["cs", "de", "en"] as const) {
        for (const row of getKeyboardRows(lang)) {
          expect(keyboardRowWidth(row, m)).toBeLessThanOrEqual(
            width - 2 * KEYBOARD_PADDING
          );
        }
      }
    }
  );

  it("touch targets are at least 44 dp tall and neighbours never overlap", () => {
    const m = keyMetrics(320);
    expect(
      KEY_HEIGHT + m.hitSlop.top + m.hitSlop.bottom
    ).toBeGreaterThanOrEqual(MIN_TARGET);
    // Slop meets in the middle of the gap between keys and between rows.
    expect(m.hitSlop.left + m.hitSlop.right).toBeLessThanOrEqual(KEY_GAP);
    expect(m.hitSlop.top + m.hitSlop.bottom).toBeLessThanOrEqual(KEY_GAP);
  });
});
