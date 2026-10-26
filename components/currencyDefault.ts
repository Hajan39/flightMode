import { deviceCurrencyCode } from "@/data/currencies";
import { getEffectiveCurrencies } from "@/store/useRatesStore";

/**
 * The home currency to preselect: the stored one, else the device's — but
 * only if the offline table (bundle + 165-code snapshot + live rates) can
 * actually convert it; an unknown code falls back to USD so a chip is
 * highlighted and conversions work.
 */
export function resolveHomeCurrency(
  stored: string | null | undefined,
  liveRates: Record<string, number> | null
): string {
  const candidate = (stored ?? deviceCurrencyCode()).toUpperCase();
  const known = getEffectiveCurrencies(liveRates).some(
    (c) => c.code === candidate
  );
  return known ? candidate : "USD";
}
