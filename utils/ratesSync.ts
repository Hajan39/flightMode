/**
 * Exchange-rate sync for the offline converter.
 *
 * Source: open.er-api.com — free, no API key, USD base, ~160 currencies,
 * refreshed daily. The app stays fully usable without it (bundled rates in
 * `data/currencies.ts`); a successful sync simply overrides `perUsd`.
 */

export const RATES_ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export type RatesSnapshot = {
	/** Units of currency per 1 USD, keyed by ISO 4217 code. */
	rates: Record<string, number>;
	/** `YYYY-MM-DD` of the provider's last update. */
	asOf: string;
};

/** Validate + normalize a provider payload; returns null on anything unexpected. */
export function parseRatesPayload(payload: unknown): RatesSnapshot | null {
	if (!payload || typeof payload !== "object") return null;
	const data = payload as {
		result?: unknown;
		rates?: unknown;
		time_last_update_unix?: unknown;
	};
	if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
		return null;
	}
	const rates: Record<string, number> = {};
	for (const [code, value] of Object.entries(data.rates as Record<string, unknown>)) {
		if (typeof value === "number" && Number.isFinite(value) && value > 0 && /^[A-Z]{3}$/.test(code)) {
			rates[code] = value;
		}
	}
	if (Object.keys(rates).length < 10 || rates.USD !== 1) return null;
	const updated =
		typeof data.time_last_update_unix === "number"
			? new Date(data.time_last_update_unix * 1000)
			: new Date();
	if (Number.isNaN(updated.getTime())) return null;
	return { rates, asOf: updated.toISOString().slice(0, 10) };
}

export async function fetchLatestRates(
	fetchImpl: typeof fetch = fetch,
): Promise<RatesSnapshot> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const response = await fetchImpl(RATES_ENDPOINT, { signal: controller.signal });
		if (!response.ok) throw new Error(`rates http ${response.status}`);
		const parsed = parseRatesPayload(await response.json());
		if (!parsed) throw new Error("rates payload invalid");
		return parsed;
	} finally {
		clearTimeout(timeout);
	}
}
