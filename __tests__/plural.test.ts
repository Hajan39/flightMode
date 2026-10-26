import {
  fallbackPluralCategory as fallbackCategory,
  getPluralCategory,
} from "@/components/plural";

describe("plural categories", () => {
  test.each([
    ["en", 1, "one"],
    ["en", 0, "other"],
    ["en", 5, "other"],
    ["cs", 1, "one"],
    ["cs", 3, "few"],
    ["cs", 5, "other"],
    ["pl", 1, "one"],
    ["pl", 22, "few"],
    ["pl", 12, "many"],
    ["pl", 5, "many"],
    ["fr", 0, "one"],
    ["hi", 1, "one"],
    ["ja", 1, "other"],
  ] as const)("fallback %s %d → %s", (language, count, expected) => {
    expect(fallbackCategory(language, count)).toBe(expected);
  });

  test("Intl result agrees with the fallback for integer counts", () => {
    for (const language of ["en", "cs", "pl", "de", "ja", "fr"] as const) {
      for (const count of [0, 1, 2, 4, 5, 12, 21, 22, 25, 101]) {
        expect(getPluralCategory(language, count)).toBe(
          fallbackCategory(language, count)
        );
      }
    }
  });
});
