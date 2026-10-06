import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  ratesAsOf as bundledAsOf,
  type Currency,
  currencies,
} from "@/data/currencies";
import {
  currencyNames,
  currencySymbols,
  zeroDecimalCurrencies,
} from "@/data/currencyNames";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { fetchLatestRates } from "@/utils/ratesSync";

/** Rates move slowly; one refresh per half day is plenty. */
const RATES_SYNC_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
/** After a failure, wait before retrying — the bootstrap effect re-runs on every status change. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
let lastFailureAt = 0;

type RatesSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

type RatesState = {
  /** Live rates from the last successful sync (per 1 USD), or null = bundled only. */
  rates: Record<string, number> | null;
  ratesAsOf: string | null;
  lastSyncAt: number | null;
  status: RatesSyncStatus;
  lastError: string | null;
  /** `force` ignores the cooldown (manual refresh button). */
  syncRates: (opts?: { force?: boolean }) => Promise<void>;
  clearRates: () => void;
};

export const useRatesStore = create<RatesState>()(
  persist(
    (set, get) => ({
      clearRates: () =>
        set({
          lastError: null,
          lastSyncAt: null,
          rates: null,
          ratesAsOf: null,
          status: "idle",
        }),
      lastError: null,
      lastSyncAt: null,
      rates: null,
      ratesAsOf: null,
      status: "idle",

      syncRates: async (opts) => {
        const state = get();
        const networkState = useNetworkStore.getState();
        const policy = useSettingsStore.getState().syncNetworkPolicy;

        if (!canSyncOnNetwork(networkState, policy)) {
          set({ lastError: null, status: "skipped" });
          return;
        }
        if (
          !opts?.force &&
          state.lastSyncAt &&
          Date.now() - state.lastSyncAt < RATES_SYNC_MIN_INTERVAL_MS
        ) {
          set({ lastError: null, status: "skipped" });
          return;
        }
        if (state.status === "syncing") {
          return;
        }
        if (
          !opts?.force &&
          Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS
        ) {
          return;
        }

        set({ lastError: null, status: "syncing" });
        try {
          const snapshot = await fetchLatestRates();
          set({
            lastError: null,
            lastSyncAt: Date.now(),
            rates: snapshot.rates,
            ratesAsOf: snapshot.asOf,
            status: "success",
          });
          captureAnalyticsEvent("rates_sync_success", {
            currency_count: Object.keys(snapshot.rates).length,
            rates_as_of: snapshot.asOf,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "rates sync failed";
          lastFailureAt = Date.now();
          set({ lastError: message, status: "error" });
          captureAnalyticsEvent("rates_sync_failed", { reason: message });
        }
      },
    }),
    {
      name: "exchange_rates",
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        rates: state.rates,
        ratesAsOf: state.ratesAsOf,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Bundled currency table with live `perUsd` values applied where available,
 * followed (alphabetically) by every extra currency the provider returned.
 * Bundled entries keep their names/symbols; codes the provider lacks keep
 * their bundled approximate rate. Without live data → bundle only.
 */
export function getEffectiveCurrencies(
  live: Record<string, number> | null,
  table: Currency[] = currencies
): Currency[] {
  if (!live) {
    return table;
  }
  const known = new Set(table.map((c) => c.code));
  const bundled = table.map((c) =>
    live[c.code] ? { ...c, perUsd: live[c.code] } : c
  );
  const extra: Currency[] = Object.keys(live)
    .filter((code) => !known.has(code) && live[code] > 0)
    .sort()
    .map((code) => ({
      code,
      nameEn: currencyNames[code] ?? code,
      perUsd: live[code],
      symbol: currencySymbols[code] ?? code,
      zeroDecimals: zeroDecimalCurrencies.has(code) || undefined,
    }));
  return [...bundled, ...extra];
}

/** Date + whether it is live or the bundled snapshot. */
export function getRatesProvenance(
  state: Pick<RatesState, "rates" | "ratesAsOf">
) {
  return state.rates && state.ratesAsOf
    ? { asOf: state.ratesAsOf, live: true as const }
    : { asOf: bundledAsOf, live: false as const };
}
