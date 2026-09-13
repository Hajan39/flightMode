import { currencies } from "@/data/currencies";
import { getEffectiveCurrencies, getRatesProvenance } from "@/store/useRatesStore";
import { fetchLatestRates, parseRatesPayload } from "@/utils/ratesSync";

const good = {
	result: "success",
	time_last_update_unix: 1756684800, // 2025-09-01
	rates: Object.fromEntries([
		["USD", 1],
		["EUR", 0.9],
		["JPY", 150],
		["CZK", 22],
		["GBP", 0.75],
		["CHF", 0.8],
		["AUD", 1.5],
		["CAD", 1.4],
		["KRW", 1400],
		["THB", 33],
		["XXX", -1],
		["bad", 5],
	]),
};

describe("parseRatesPayload", () => {
	test("accepts a valid payload, drops junk entries, dates it", () => {
		const parsed = parseRatesPayload(good);
		expect(parsed).not.toBeNull();
		expect(parsed!.rates.EUR).toBe(0.9);
		expect(parsed!.rates.XXX).toBeUndefined();
		expect(parsed!.rates.bad).toBeUndefined();
		expect(parsed!.asOf).toBe("2025-09-01");
	});

	test("rejects failures, non-USD base and tiny payloads", () => {
		expect(parseRatesPayload(null)).toBeNull();
		expect(parseRatesPayload({ result: "error" })).toBeNull();
		expect(parseRatesPayload({ result: "success", rates: { USD: 2, EUR: 1 } })).toBeNull();
		expect(parseRatesPayload({ result: "success", rates: { USD: 1, EUR: 0.9 } })).toBeNull();
	});
});

describe("fetchLatestRates", () => {
	test("throws on http error and on invalid payload", async () => {
		const bad = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
		await expect(fetchLatestRates(bad)).rejects.toThrow("rates http 500");
		const invalid = (async () => ({ ok: true, status: 200, json: async () => ({ result: "error" }) })) as unknown as typeof fetch;
		await expect(fetchLatestRates(invalid)).rejects.toThrow("rates payload invalid");
	});

	test("returns parsed snapshot on success", async () => {
		const ok = (async () => ({ ok: true, status: 200, json: async () => good })) as unknown as typeof fetch;
		const snap = await fetchLatestRates(ok);
		expect(snap.rates.JPY).toBe(150);
	});
});

describe("getEffectiveCurrencies / provenance", () => {
	test("overrides perUsd only where live data exists, keeps names", () => {
		const effective = getEffectiveCurrencies({ EUR: 0.5 }, currencies);
		const eur = effective.find((c) => c.code === "EUR")!;
		const czk = effective.find((c) => c.code === "CZK")!;
		expect(eur.perUsd).toBe(0.5);
		expect(eur.nameEn).toBe("Euro");
		expect(czk.perUsd).toBe(currencies.find((c) => c.code === "CZK")!.perUsd);
		expect(getEffectiveCurrencies(null, currencies)).toBe(currencies);
	});

	test("appends provider-only currencies with names, sorted after the bundle", () => {
		const effective = getEffectiveCurrencies({ EUR: 0.9, PHP: 56, NOK: 10.5, XXX: 1 }, currencies);
		const codes = effective.map((c) => c.code);
		expect(codes.slice(0, currencies.length)).toEqual(currencies.map((c) => c.code));
		expect(codes.slice(currencies.length)).toEqual(["NOK", "PHP", "XXX"]);
		const php = effective.find((c) => c.code === "PHP")!;
		expect(php.nameEn).toBe("Philippine Peso");
		expect(php.symbol).toBe("₱");
		expect(php.perUsd).toBe(56);
	});

	test("provenance flags live vs bundled", () => {
		expect(getRatesProvenance({ rates: null, ratesAsOf: null }).live).toBe(false);
		expect(getRatesProvenance({ rates: { USD: 1 }, ratesAsOf: "2026-09-13" })).toEqual({ live: true, asOf: "2026-09-13" });
	});
});
