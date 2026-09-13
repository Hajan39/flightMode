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
		expect(convertUnit(212, "temperature", "imperialToMetric")).toBeCloseTo(100);
	});

	test("distance and weight round-trip", () => {
		expect(convertUnit(100, "distance", "metricToImperial")).toBeCloseTo(62.137, 3);
		expect(convertUnit(1, "weight", "metricToImperial")).toBeCloseTo(2.2046, 4);
		const back = convertUnit(
			convertUnit(42, "distance", "metricToImperial"),
			"distance",
			"imperialToMetric",
		);
		expect(back).toBeCloseTo(42, 9);
	});

	test("formatUnit trims noise", () => {
		expect(formatUnit(62.137)).toBe("62.1");
		expect(formatUnit(1234.5)).toBe("1235");
		expect(formatUnit(2.2046)).toBe("2.2");
		expect(formatUnit(32)).toBe("32");
	});
});

describe("convertCurrency", () => {
	test("identity and via-USD conversion", () => {
		expect(convertCurrency(10, "USD", "USD")).toBe(10);
		const jpy = currencies.find((c) => c.code === "JPY")!;
		expect(convertCurrency(1, "USD", "JPY")).toBeCloseTo(jpy.perUsd);
		expect(convertCurrency(jpy.perUsd, "JPY", "USD")).toBeCloseTo(1);
	});

	test("unknown code or bad amount returns null", () => {
		expect(convertCurrency(1, "USD", "XXX")).toBeNull();
		expect(convertCurrency(Number.NaN, "USD", "EUR")).toBeNull();
	});

	test("formatCurrency honours zero-decimal currencies", () => {
		expect(formatCurrency(1234.567, "EUR")).toBe("€ 1 234.57");
		expect(formatCurrency(148000, "JPY")).toBe("¥ 148 000");
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
	});
});

describe("currencies data", () => {
	test("unique codes, positive rates, USD is the base", () => {
		const codes = currencies.map((c) => c.code);
		expect(new Set(codes).size).toBe(codes.length);
		for (const c of currencies) expect(c.perUsd).toBeGreaterThan(0);
		expect(currencies.find((c) => c.code === "USD")?.perUsd).toBe(1);
		expect(Number.isFinite(Date.parse(ratesAsOf))).toBe(true);
	});

	test("every destination currency exists", () => {
		const codes = new Set(currencies.map((c) => c.code));
		for (const d of destinations) expect(codes.has(d.currencyCode)).toBe(true);
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
			expect(phraseLanguages[d.phraseLanguage]).toBeDefined();
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
