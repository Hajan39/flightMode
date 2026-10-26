import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
import { snapshotPerUsd } from "@/data/currencyRatesSnapshot";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { sanitizeErrorText } from "@/utils/errorLogging";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";
import { fetchLatestRates } from "@/utils/ratesSync";

/** Rates move slowly; one refresh per half day is plenty. */
const RATES_SYNC_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
/** After a failure, wait before retrying — the bootstrap effect re-runs on every status change. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
let lastFailureAt = 0;

type RatesSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

interface RatesState {
  clearRates: () => void;
  lastError: string | null;
  lastSyncAt: number | null;
  /** Live rates from the last successful sync (per 1 USD), or null = bundled only. */
  rates: Record<string, number> | null;
  ratesAsOf: string | null;
  status: RatesSyncStatus;
  /** `force` ignores the cooldown (manual refresh button). */
  syncRates: (opts?: { force?: boolean }) => Promise<void>;
}

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
        // Before hydration lastSyncAt is null (cooldown skipped) and the sync
        // policy is the default; wait — the bootstrap retries after loading.
        if (!syncInputsHydrated()) {
          return;
        }
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
          captureAnalyticsEvent("rates_sync_failed", {
            error_name: error instanceof Error ? error.name : "unknown",
            reason: sanitizeErrorText(message),
          });
        }
      },
    }),
    safePersistOptions(() => AsyncStorage, {
      name: "exchange_rates",
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        rates: state.rates,
        ratesAsOf: state.ratesAsOf,
      }),
    })
  )
);
enablePersistRecovery(useRatesStore);

/**
 * Bundled currency table with live `perUsd` values applied where available,
 * followed (alphabetically) by every other currency we have a rate for: live
 * provider codes first-hand, otherwise the bundled offline snapshot
 * (`data/currencyRatesSnapshot.ts`). So the full list — and a home currency
 * outside the curated table — converts offline before any live sync.
 */
export function getEffectiveCurrencies(
  live: Record<string, number> | null,
  table: Currency[] = currencies,
  snapshot: Readonly<Record<string, number>> = snapshotPerUsd
): Currency[] {
  const known = new Set(table.map((c) => c.code));
  const bundled = live
    ? table.map((c) => (live[c.code] ? { ...c, perUsd: live[c.code] } : c))
    : table;
  const rates: Record<string, number> = { ...snapshot, ...(live ?? {}) };
  const extra: Currency[] = Object.keys(rates)
    .filter((code) => !known.has(code) && rates[code] > 0)
    .sort()
    .map((code) => ({
      code,
      nameEn: currencyNames[code] ?? code,
      perUsd: rates[code],
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

/** Cooldown timestamps and the sync policy are only real once both stores loaded. */
function syncInputsHydrated() {
  return (
    useRatesStore.persist.hasHydrated() &&
    useSettingsStore.persist.hasHydrated()
  );
}
