import { currencies, ratesAsOf } from "@/data/currencies";
import { destinations } from "@/data/destinations";
import {
  nonLatinScripts,
  phraseIds,
  phraseLanguageList,
  phraseLanguages,
} from "@/data/phrases";
import {
  convertCurrency,
  convertUnit,
  formatCurrency,
  formatUnit,
  getRatesAgeDays,
  parseAmount,
} from "@/utils/convert";
import { addDays, toLocalDateKey } from "@/utils/dates";

describe("convertUnit", () => {
  test("temperature", () => {
    expect(convertUnit(0, "temperature", "metricToImperial")).toBe(32);
    expect(convertUnit(100, "temperature", "metricToImperial")).toBe(212);
    expect(convertUnit(212, "temperature", "imperialToMetric")).toBeCloseTo(
      100
    );
  });

  test("distance and weight round-trip", () => {
    expect(convertUnit(100, "distance", "metricToImperial")).toBeCloseTo(
      62.137,
      3
    );
    expect(convertUnit(1, "weight", "metricToImperial")).toBeCloseTo(2.2046, 4);
    const back = convertUnit(
      convertUnit(42, "distance", "metricToImperial"),
      "distance",
      "imperialToMetric"
    );
    expect(back).toBeCloseTo(42, 9);
  });

  test("formatUnit trims noise", () => {
    expect(formatUnit(62.137)).toBe("62.1");
    expect(formatUnit(1234.5)).toBe("1235");
    expect(formatUnit(2.2046)).toBe("2.2");
    expect(formatUnit(32)).toBe("32");
  });

  test("formatUnit picks decimals by magnitude, also for negatives", () => {
    expect(formatUnit(1.256)).toBe("1.26");
    expect(formatUnit(1.5)).toBe("1.5");
    expect(formatUnit(-12.34)).toBe("-12.3");
    expect(formatUnit(-140.6)).toBe("-141");
    expect(formatUnit(Number.NaN)).toBe("–");
    expect(formatUnit(Number.POSITIVE_INFINITY)).toBe("–");
  });

  test("temperature reference points both ways", () => {
    expect(convertUnit(-40, "temperature", "metricToImperial")).toBe(-40);
    expect(convertUnit(98.6, "temperature", "imperialToMetric")).toBeCloseTo(
      37,
      9
    );
    expect(convertUnit(10, "weight", "imperialToMetric")).toBeCloseTo(
      4.5359,
      4
    );
    expect(convertUnit(1, "distance", "imperialToMetric")).toBeCloseTo(
      1.609_344,
      9
    );
  });
});

describe("convertCurrency", () => {
  test("identity and via-USD conversion", () => {
    expect(convertCurrency(10, "USD", "USD")).toBe(10);
    const jpy = currencies.find((c) => c.code === "JPY");
    if (!jpy) {
      throw new Error("JPY missing from bundled currencies");
    }
    expect(convertCurrency(1, "USD", "JPY")).toBeCloseTo(jpy.perUsd);
    expect(convertCurrency(jpy.perUsd, "JPY", "USD")).toBeCloseTo(1);
  });

  test("unknown code or bad amount returns null", () => {
    expect(convertCurrency(1, "USD", "XXX")).toBeNull();
    expect(convertCurrency(1, "XXX", "USD")).toBeNull();
    expect(convertCurrency(Number.NaN, "USD", "EUR")).toBeNull();
    expect(convertCurrency(Number.POSITIVE_INFINITY, "USD", "EUR")).toBeNull();
  });

  test("a zero or negative rate in the table is rejected, not divided by", () => {
    const table = [
      { code: "USD", nameEn: "US Dollar", perUsd: 1, symbol: "$" },
      { code: "AAA", nameEn: "Zero", perUsd: 0, symbol: "A" },
      { code: "BBB", nameEn: "Negative", perUsd: -2, symbol: "B" },
    ];
    expect(convertCurrency(10, "AAA", "USD", table)).toBeNull();
    expect(convertCurrency(10, "USD", "AAA", table)).toBeNull();
    expect(convertCurrency(10, "USD", "BBB", table)).toBeNull();
  });

  test("currency codes are case-insensitive", () => {
    const jpy = currencies.find((c) => c.code === "JPY")?.perUsd ?? 0;
    expect(convertCurrency(2, "usd", "jpy")).toBeCloseTo(2 * jpy);
    expect(formatCurrency(5, "eur")).toBe("€ 5.00");
  });

  test("cross rate goes via USD (EUR → JPY)", () => {
    const eur = currencies.find((c) => c.code === "EUR")?.perUsd ?? 0;
    const jpy = currencies.find((c) => c.code === "JPY")?.perUsd ?? 0;
    expect(convertCurrency(100, "EUR", "JPY")).toBeCloseTo(
      (100 / eur) * jpy,
      6
    );
  });

  test("formatCurrency honours zero-decimal currencies", () => {
    expect(formatCurrency(1234.567, "EUR")).toBe("€ 1 234.57");
    expect(formatCurrency(148_000, "JPY")).toBe("¥ 148 000");
  });

  test("parseAmount accepts comma decimals and spaces", () => {
    expect(parseAmount("1 234,5")).toBe(1234.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  test("getRatesAgeDays", () => {
    const asOf = Date.UTC(2026, 8, 1);
    expect(getRatesAgeDays("2026-09-01", asOf + 3 * 86_400_000)).toBe(3);
    expect(getRatesAgeDays("not-a-date", asOf)).toBe(0);
    // Partial days round down; a snapshot "from the future" (clock skew) is 0, not negative.
    expect(getRatesAgeDays("2026-09-01", asOf + 86_400_000 - 1)).toBe(0);
    expect(getRatesAgeDays("2026-09-01", asOf - 5 * 86_400_000)).toBe(0);
  });

  test("parseAmount handles plain, negative and decimal-point input", () => {
    expect(parseAmount("42")).toBe(42);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount(" 7 ")).toBe(7);
    expect(parseAmount("   ")).toBeNull();
  });
});

describe("parseAmount separator table", () => {
  test.each([
    // plain / previously working
    ["42", 42],
    ["12.5", 12.5],
    ["12,5", 12.5],
    ["12,50", 12.5],
    [" 7 ", 7],
    [".5", 0.5],
    [",5", 0.5],
    ["5.", 5],
    ["5,", 5],
    ["0", 0],
    ["0,125", 0.125],
    ["1.234", 1.234],
    ["1,2345", 1.2345],
    ["-5", -5],
    // spaces / NBSP / thin / narrow no-break spaces as grouping
    ["1 234,5", 1234.5],
    ["1 234,50", 1234.5],
    ["1\u00a0234,50", 1234.5],
    ["1\u2009234.5", 1234.5],
    ["1\u202f234\u202f567", 1_234_567],
    ["1 234 567", 1_234_567],
    // both separators: the last one is the decimal
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["1.234.567,89", 1_234_567.89],
    ["1,234,567.89", 1_234_567.89],
    ["1,234.", 1234],
    // one kind repeated = grouping
    ["1,234", 1234],
    ["1,234,567", 1_234_567],
    ["1.234.567", 1_234_567],
    ["12,345,678", 12_345_678],
  ])("%j → %d", (input, expected) => {
    expect(parseAmount(input)).toBeCloseTo(expected, 9);
  });

  test.each([
    "",
    "   ",
    "abc",
    "1a",
    "1e3",
    "0x10",
    "Infinity",
    ".",
    ",",
    "-",
    "1..2",
    "1,,2",
    "1.2.3",
    "1,23,456",
    "1.23.456",
    "1,234,56",
    "1.234,5.6",
    "1,234.5,6",
    "12,34.5",
    "1.2,3,4",
    "--1",
    "1-2",
  ])("%j → null", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("currencies data", () => {
  test("unique codes, positive rates, USD is the base", () => {
    const codes = currencies.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of currencies) {
      expect(c.perUsd).toBeGreaterThan(0);
    }
    expect(currencies.find((c) => c.code === "USD")?.perUsd).toBe(1);
    expect(Number.isFinite(Date.parse(ratesAsOf))).toBe(true);
  });

  test("every destination currency exists", () => {
    const codes = new Set(currencies.map((c) => c.code));
    for (const d of destinations) {
      expect(codes.has(d.currencyCode)).toBe(true);
    }
  });
});

describe("phrases data", () => {
  test("every language has all phrases with non-empty native text", () => {
    for (const lang of phraseLanguageList) {
      expect(lang.nativeName.length).toBeGreaterThan(0);
      for (const id of phraseIds) {
        expect(lang.phrases[id].native.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("non-Latin scripts always carry romanization", () => {
    for (const code of nonLatinScripts) {
      const lang = phraseLanguages[code];
      expect(lang.nonLatin).toBe(true);
      for (const id of phraseIds) {
        expect(lang.phrases[id].roman?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  test("every destination phrase language resolves", () => {
    for (const d of destinations) {
      expect(phraseLanguages[d.phraseLanguage]?.code).toBe(d.phraseLanguage);
    }
  });

  test("English is listed first", () => {
    expect(phraseLanguageList[0].code).toBe("en");
  });
});

describe("dates", () => {
  test("toLocalDateKey uses the local calendar day", () => {
    const d = new Date(2026, 0, 1, 0, 30);
    expect(toLocalDateKey(d)).toBe("2026-01-01");
  });

  test("addDays crosses month boundaries", () => {
    const d = new Date(2026, 0, 31, 12);
    expect(toLocalDateKey(addDays(d, 1))).toBe("2026-02-01");
    expect(toLocalDateKey(addDays(d, -31))).toBe("2025-12-31");
  });
});
