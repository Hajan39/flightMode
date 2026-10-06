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

import { getLocales } from "expo-localization";

export const ratesAsOf = "2026-09-01";

export const baseCurrency = "USD";

export interface Currency {
  /** ISO 4217 code. */
  code: string;
  /** English name (proper noun, not translated). */
  nameEn: string;
  /** Units of this currency per 1 USD. */
  perUsd: number;
  /** Common symbol or short label shown next to amounts. */
  symbol: string;
  /** Currencies whose smallest practical unit is the whole unit. */
  zeroDecimals?: boolean;
}

export const currencies: Currency[] = [
  { code: "USD", nameEn: "US Dollar", perUsd: 1, symbol: "$" },
  { code: "EUR", nameEn: "Euro", perUsd: 0.86, symbol: "€" },
  { code: "GBP", nameEn: "British Pound", perUsd: 0.74, symbol: "£" },
  { code: "CHF", nameEn: "Swiss Franc", perUsd: 0.8, symbol: "CHF" },
  {
    code: "JPY",
    nameEn: "Japanese Yen",
    perUsd: 148,
    symbol: "¥",
    zeroDecimals: true,
  },
  {
    code: "KRW",
    nameEn: "South Korean Won",
    perUsd: 1390,
    symbol: "₩",
    zeroDecimals: true,
  },
  { code: "CNY", nameEn: "Chinese Yuan", perUsd: 7.1, symbol: "¥" },
  { code: "THB", nameEn: "Thai Baht", perUsd: 32, symbol: "฿" },
  {
    code: "VND",
    nameEn: "Vietnamese Dong",
    perUsd: 26_300,
    symbol: "₫",
    zeroDecimals: true,
  },
  {
    code: "IDR",
    nameEn: "Indonesian Rupiah",
    perUsd: 16_400,
    symbol: "Rp",
    zeroDecimals: true,
  },
  { code: "MYR", nameEn: "Malaysian Ringgit", perUsd: 4.2, symbol: "RM" },
  { code: "SGD", nameEn: "Singapore Dollar", perUsd: 1.28, symbol: "S$" },
  { code: "INR", nameEn: "Indian Rupee", perUsd: 88, symbol: "₹" },
  { code: "AED", nameEn: "UAE Dirham", perUsd: 3.67, symbol: "AED" },
  { code: "QAR", nameEn: "Qatari Riyal", perUsd: 3.64, symbol: "QR" },
  { code: "TRY", nameEn: "Turkish Lira", perUsd: 41, symbol: "₺" },
  { code: "EGP", nameEn: "Egyptian Pound", perUsd: 48.5, symbol: "E£" },
  { code: "MAD", nameEn: "Moroccan Dirham", perUsd: 9.1, symbol: "MAD" },
  { code: "KES", nameEn: "Kenyan Shilling", perUsd: 129, symbol: "KSh" },
  { code: "ZAR", nameEn: "South African Rand", perUsd: 17.6, symbol: "R" },
  { code: "AUD", nameEn: "Australian Dollar", perUsd: 1.52, symbol: "A$" },
  { code: "NZD", nameEn: "New Zealand Dollar", perUsd: 1.69, symbol: "NZ$" },
  { code: "CAD", nameEn: "Canadian Dollar", perUsd: 1.38, symbol: "C$" },
  { code: "MXN", nameEn: "Mexican Peso", perUsd: 18.7, symbol: "MX$" },
  { code: "BRL", nameEn: "Brazilian Real", perUsd: 5.4, symbol: "R$" },
  {
    code: "ARS",
    nameEn: "Argentine Peso",
    perUsd: 1350,
    symbol: "AR$",
    zeroDecimals: true,
  },
  { code: "PEN", nameEn: "Peruvian Sol", perUsd: 3.5, symbol: "S/" },
  {
    code: "ISK",
    nameEn: "Icelandic Króna",
    perUsd: 123,
    symbol: "kr",
    zeroDecimals: true,
  },
  { code: "SEK", nameEn: "Swedish Krona", perUsd: 9.4, symbol: "kr" },
  { code: "DKK", nameEn: "Danish Krone", perUsd: 6.4, symbol: "kr" },
  { code: "CZK", nameEn: "Czech Koruna", perUsd: 21, symbol: "Kč" },
  { code: "PLN", nameEn: "Polish Złoty", perUsd: 3.65, symbol: "zł" },
  {
    code: "HUF",
    nameEn: "Hungarian Forint",
    perUsd: 340,
    symbol: "Ft",
    zeroDecimals: true,
  },
];

export const currenciesByCode: Record<string, Currency> = Object.fromEntries(
  currencies.map((c) => [c.code, c])
);

/** Codes offered as quick chips before the traveller searches the full list. */
export const POPULAR_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "CZK",
  "PLN",
  "SEK",
  "NOK",
  "DKK",
  "HUF",
  "JPY",
  "CNY",
  "KRW",
  "INR",
  "AUD",
  "CAD",
  "NZD",
  "SGD",
  "AED",
  "BRL",
  "MXN",
  "ZAR",
  "TRY",
  "THB",
];

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;

/** ISO code from the device locale, falling back to USD. */
export function deviceCurrencyCode(): string {
  const code = getLocales()[0]?.currencyCode?.toUpperCase();
  return code && ISO_CURRENCY_CODE.test(code) ? code : "USD";
}

export function getCurrency(
  code: string | undefined | null
): Currency | undefined {
  if (!code) {
    return undefined;
  }
  return currenciesByCode[code.toUpperCase()];
}
