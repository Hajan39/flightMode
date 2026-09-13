/**
 * Bundled approximate exchange rates for the offline converter.
 *
 * Rates are "units of currency per 1 USD" and are intentionally coarse —
 * the converter shows `ratesAsOf` and a disclaimer. Refresh this table when
 * cutting a release (see documents/todo-and-improvements.md).
 *
 * Every `currencyCode` used in `data/destinations.ts` must exist here
 * (`__tests__/currencies.test.ts` enforces it).
 */

export const ratesAsOf = "2026-09-01";

export const baseCurrency = "USD";

export type Currency = {
	/** ISO 4217 code. */
	code: string;
	/** Common symbol or short label shown next to amounts. */
	symbol: string;
	/** English name (proper noun, not translated). */
	nameEn: string;
	/** Units of this currency per 1 USD. */
	perUsd: number;
	/** Currencies whose smallest practical unit is the whole unit. */
	zeroDecimals?: boolean;
};

export const currencies: Currency[] = [
	{ code: "USD", symbol: "$", nameEn: "US Dollar", perUsd: 1 },
	{ code: "EUR", symbol: "€", nameEn: "Euro", perUsd: 0.86 },
	{ code: "GBP", symbol: "£", nameEn: "British Pound", perUsd: 0.74 },
	{ code: "CHF", symbol: "CHF", nameEn: "Swiss Franc", perUsd: 0.8 },
	{ code: "JPY", symbol: "¥", nameEn: "Japanese Yen", perUsd: 148, zeroDecimals: true },
	{ code: "KRW", symbol: "₩", nameEn: "South Korean Won", perUsd: 1390, zeroDecimals: true },
	{ code: "CNY", symbol: "¥", nameEn: "Chinese Yuan", perUsd: 7.1 },
	{ code: "THB", symbol: "฿", nameEn: "Thai Baht", perUsd: 32 },
	{ code: "VND", symbol: "₫", nameEn: "Vietnamese Dong", perUsd: 26300, zeroDecimals: true },
	{ code: "IDR", symbol: "Rp", nameEn: "Indonesian Rupiah", perUsd: 16400, zeroDecimals: true },
	{ code: "MYR", symbol: "RM", nameEn: "Malaysian Ringgit", perUsd: 4.2 },
	{ code: "SGD", symbol: "S$", nameEn: "Singapore Dollar", perUsd: 1.28 },
	{ code: "INR", symbol: "₹", nameEn: "Indian Rupee", perUsd: 88 },
	{ code: "AED", symbol: "AED", nameEn: "UAE Dirham", perUsd: 3.67 },
	{ code: "QAR", symbol: "QR", nameEn: "Qatari Riyal", perUsd: 3.64 },
	{ code: "TRY", symbol: "₺", nameEn: "Turkish Lira", perUsd: 41 },
	{ code: "EGP", symbol: "E£", nameEn: "Egyptian Pound", perUsd: 48.5 },
	{ code: "MAD", symbol: "MAD", nameEn: "Moroccan Dirham", perUsd: 9.1 },
	{ code: "KES", symbol: "KSh", nameEn: "Kenyan Shilling", perUsd: 129 },
	{ code: "ZAR", symbol: "R", nameEn: "South African Rand", perUsd: 17.6 },
	{ code: "AUD", symbol: "A$", nameEn: "Australian Dollar", perUsd: 1.52 },
	{ code: "NZD", symbol: "NZ$", nameEn: "New Zealand Dollar", perUsd: 1.69 },
	{ code: "CAD", symbol: "C$", nameEn: "Canadian Dollar", perUsd: 1.38 },
	{ code: "MXN", symbol: "MX$", nameEn: "Mexican Peso", perUsd: 18.7 },
	{ code: "BRL", symbol: "R$", nameEn: "Brazilian Real", perUsd: 5.4 },
	{ code: "ARS", symbol: "AR$", nameEn: "Argentine Peso", perUsd: 1350, zeroDecimals: true },
	{ code: "PEN", symbol: "S/", nameEn: "Peruvian Sol", perUsd: 3.5 },
	{ code: "ISK", symbol: "kr", nameEn: "Icelandic Króna", perUsd: 123, zeroDecimals: true },
	{ code: "SEK", symbol: "kr", nameEn: "Swedish Krona", perUsd: 9.4 },
	{ code: "DKK", symbol: "kr", nameEn: "Danish Krone", perUsd: 6.4 },
	{ code: "CZK", symbol: "Kč", nameEn: "Czech Koruna", perUsd: 21 },
	{ code: "PLN", symbol: "zł", nameEn: "Polish Złoty", perUsd: 3.65 },
	{ code: "HUF", symbol: "Ft", nameEn: "Hungarian Forint", perUsd: 340, zeroDecimals: true },
];

export const currenciesByCode: Record<string, Currency> = Object.fromEntries(
	currencies.map((c) => [c.code, c]),
);

export function getCurrency(code: string | undefined | null): Currency | undefined {
	if (!code) return undefined;
	return currenciesByCode[code.toUpperCase()];
}
