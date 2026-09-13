import { currencies, getCurrency, type Currency } from "@/data/currencies";
import { currencySymbols, zeroDecimalCurrencies } from "@/data/currencyNames";

/**
 * Pure conversion helpers for the offline converter screen.
 * No React / RN imports so they stay unit-testable in Jest.
 */

/** Convert between two currencies via the USD base. Returns null on unknown codes or bad input. */
export function convertCurrency(
	amount: number,
	from: string,
	to: string,
	table: Currency[] = currencies,
): number | null {
	if (!Number.isFinite(amount)) return null;
	const byCode = new Map(table.map((c) => [c.code, c]));
	const source = byCode.get(from.toUpperCase());
	const target = byCode.get(to.toUpperCase());
	if (!source || !target || source.perUsd <= 0 || target.perUsd <= 0) {
		return null;
	}
	const usd = amount / source.perUsd;
	return usd * target.perUsd;
}

/** Format an amount for display, honouring zero-decimal currencies. */
export function formatCurrency(amount: number, code: string): string {
	const upper = code.toUpperCase();
	const currency = getCurrency(upper);
	const zero = currency?.zeroDecimals ?? zeroDecimalCurrencies.has(upper);
	const decimals = zero ? 0 : 2;
	const rounded = amount.toFixed(decimals);
	// Thousands separator with a plain space — locale-neutral and readable.
	const [intPart, fracPart] = rounded.split(".");
	const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
	const symbol = currency?.symbol ?? currencySymbols[upper] ?? upper;
	return fracPart ? `${symbol} ${grouped}.${fracPart}` : `${symbol} ${grouped}`;
}

export type UnitKind = "temperature" | "distance" | "weight";
export type UnitDirection = "metricToImperial" | "imperialToMetric";

/** Metric ↔ imperial for the three pairs travellers actually need. */
export function convertUnit(
	value: number,
	kind: UnitKind,
	direction: UnitDirection,
): number {
	const toImperial = direction === "metricToImperial";
	switch (kind) {
		case "temperature":
			return toImperial ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
		case "distance":
			return toImperial ? value / 1.609344 : value * 1.609344;
		case "weight":
			return toImperial ? value / 0.45359237 : value * 0.45359237;
	}
}

/** Unit labels for each kind: [metric, imperial]. */
export const unitLabels: Record<UnitKind, [string, string]> = {
	temperature: ["°C", "°F"],
	distance: ["km", "mi"],
	weight: ["kg", "lb"],
};

/** Round to a sensible number of decimals for display. */
export function formatUnit(value: number): string {
	if (!Number.isFinite(value)) return "–";
	const abs = Math.abs(value);
	const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
	return value.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Whole days since the rates snapshot (0 when the date is unparseable). */
export function getRatesAgeDays(ratesAsOf: string, nowMs: number): number {
	const asOf = Date.parse(`${ratesAsOf}T00:00:00Z`);
	if (!Number.isFinite(asOf)) return 0;
	return Math.max(0, Math.floor((nowMs - asOf) / 86_400_000));
}

/** Parse a user-typed amount ("1 234,5" → 1234.5). Returns null when empty/invalid. */
export function parseAmount(input: string): number | null {
	const cleaned = input.replace(/\s/g, "").replace(",", ".");
	if (cleaned.length === 0) return null;
	const value = Number(cleaned);
	return Number.isFinite(value) ? value : null;
}
