import { type Currency, currencies, getCurrency } from "@/data/currencies";
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
  table: Currency[] = currencies
): number | null {
  if (!Number.isFinite(amount)) {
    return null;
  }
  const byCode = new Map(table.map((c) => [c.code, c]));
  const source = byCode.get(from.toUpperCase());
  const target = byCode.get(to.toUpperCase());
  if (!(source && target) || source.perUsd <= 0 || target.perUsd <= 0) {
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
  direction: UnitDirection
): number {
  const toImperial = direction === "metricToImperial";
  switch (kind) {
    case "temperature":
      return toImperial ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
    case "distance":
      return toImperial ? value / 1.609_344 : value * 1.609_344;
    case "weight":
      return toImperial ? value / 0.453_592_37 : value * 0.453_592_37;
    default:
      // Unreachable: UnitKind is exhaustive above.
      return value;
  }
}

/** Trailing ".0"/".00" after toFixed. */
const TRAILING_ZERO_DECIMALS = /\.0+$/;
/** Trailing zeros after a non-zero decimal part. */
const TRAILING_ZEROS = /(\.\d*?)0+$/;

/** Unit labels for each kind: [metric, imperial]. */
export const unitLabels: Record<UnitKind, [string, string]> = {
  distance: ["km", "mi"],
  temperature: ["°C", "°F"],
  weight: ["kg", "lb"],
};

/** Round to a sensible number of decimals for display. */
export function formatUnit(value: number): string {
  if (!Number.isFinite(value)) {
    return "–";
  }
  const abs = Math.abs(value);
  let decimals = 2;
  if (abs >= 100) {
    decimals = 0;
  } else if (abs >= 10) {
    decimals = 1;
  }
  return value
    .toFixed(decimals)
    .replace(TRAILING_ZERO_DECIMALS, "")
    .replace(TRAILING_ZEROS, "$1");
}

/** Whole days since the rates snapshot (0 when the date is unparseable). */
export function getRatesAgeDays(ratesAsOf: string, nowMs: number): number {
  const asOf = Date.parse(`${ratesAsOf}T00:00:00Z`);
  if (!Number.isFinite(asOf)) {
    return 0;
  }
  return Math.max(0, Math.floor((nowMs - asOf) / 86_400_000));
}

/** Any whitespace, incl. NBSP / thin / narrow no-break spaces (digit grouping). */
const AMOUNT_SPACES = /\s/g;
const AMOUNT_CHARS = /^-?[\d.,]*\d[\d.,]*$/;
const DIGITS = /^\d*$/;
const LEAD_GROUP = /^\d{1,3}$/;
const LEAD_GROUP_NO_ZERO = /^[1-9]\d{0,2}$/;
const THREE_DIGITS = /^\d{3}$/;

/** `int` uses `sep` as a thousands separator: 1–3 digits, then groups of 3. */
function isGrouped(int: string, sep: string): boolean {
  const groups = int.split(sep);
  return (
    groups.length > 1 &&
    LEAD_GROUP.test(groups[0]) &&
    groups.slice(1).every((g) => THREE_DIGITS.test(g))
  );
}

/** "int.frac" from validated digit strings (either may be empty, not both). */
function toNumber(sign: string, int: string, frac: string): number | null {
  if (
    !(DIGITS.test(int) && DIGITS.test(frac)) ||
    int.length + frac.length === 0
  ) {
    return null;
  }
  const value = Number(`${sign}${int || "0"}.${frac || "0"}`);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a user-typed amount, whatever the locale's separators:
 * "1 234,5", "1.234,5", "1,234.5", "1,234,567", "1.234.567", "12,50", "12.5".
 * - Spaces (incl. NBSP / thin spaces) are grouping and are stripped.
 * - Both "." and ",": the LAST one is the decimal separator, the other groups.
 * - Only ",": decimal when it appears once (",234" style 3-digit tails after a
 *   valid leading group are grouping: "1,234" → 1234); repeated → grouping.
 * - Only ".": decimal when it appears once ("1.234" → 1.234); repeated →
 *   grouping ("1.234.567" → 1234567).
 * Returns null when empty or not a well-formed amount.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(AMOUNT_SPACES, "");
  if (!AMOUNT_CHARS.test(cleaned)) {
    return null;
  }
  const sign = cleaned.startsWith("-") ? "-" : "";
  const body = sign ? cleaned.slice(1) : cleaned;
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");

  if (lastDot === -1 && lastComma === -1) {
    return toNumber(sign, body, "");
  }

  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    const at = Math.max(lastDot, lastComma);
    const int = body.slice(0, at);
    const frac = body.slice(at + 1);
    if (int.includes(decimal) || !isGrouped(int, group)) {
      return null;
    }
    return toNumber(sign, int.split(group).join(""), frac);
  }

  const sep = lastDot === -1 ? "," : ".";
  const parts = body.split(sep);
  if (parts.length > 2) {
    return isGrouped(body, sep) ? toNumber(sign, parts.join(""), "") : null;
  }
  const [int, frac] = parts;
  // A lone comma with exactly 3 trailing digits after a 1–3 digit group
  // without a leading zero is a thousands separator ("1,234"); a lone dot
  // stays decimal ("1.234" → 1.234, as before).
  if (sep === "," && LEAD_GROUP_NO_ZERO.test(int) && THREE_DIGITS.test(frac)) {
    return toNumber(sign, `${int}${frac}`, "");
  }
  return toNumber(sign, int, frac);
}
