import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { currencies, type Currency, ratesAsOf as bundledAsOf } from "@/data/currencies";
import { currencyNames, currencySymbols, zeroDecimalCurrencies } from "@/data/currencyNames";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { fetchLatestRates } from "@/utils/ratesSync";

/** Rates move slowly; one refresh per half day is plenty. */
const RATES_SYNC_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

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
			rates: null,
			ratesAsOf: null,
			lastSyncAt: null,
			status: "idle",
			lastError: null,

			syncRates: async (opts) => {
				const state = get();
				const networkState = useNetworkStore.getState();
				const policy = useSettingsStore.getState().syncNetworkPolicy;

				if (!canSyncOnNetwork(networkState, policy)) {
					set({ status: "skipped", lastError: null });
					return;
				}
				if (
					!opts?.force &&
					state.lastSyncAt &&
					Date.now() - state.lastSyncAt < RATES_SYNC_MIN_INTERVAL_MS
				) {
					set({ status: "skipped", lastError: null });
					return;
				}
				if (state.status === "syncing") return;

				set({ status: "syncing", lastError: null });
				try {
					const snapshot = await fetchLatestRates();
					set({
						rates: snapshot.rates,
						ratesAsOf: snapshot.asOf,
						lastSyncAt: Date.now(),
						status: "success",
						lastError: null,
					});
					captureAnalyticsEvent("rates_sync_success", {
						currency_count: Object.keys(snapshot.rates).length,
						rates_as_of: snapshot.asOf,
					});
				} catch (error) {
					const message = error instanceof Error ? error.message : "rates sync failed";
					set({ status: "error", lastError: message });
					captureAnalyticsEvent("rates_sync_failed", { reason: message });
				}
			},

			clearRates: () =>
				set({ rates: null, ratesAsOf: null, lastSyncAt: null, status: "idle", lastError: null }),
		}),
		{
			name: "exchange_rates",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: (state) => ({
				rates: state.rates,
				ratesAsOf: state.ratesAsOf,
				lastSyncAt: state.lastSyncAt,
			}),
		},
	),
);

/**
 * Bundled currency table with live `perUsd` values applied where available,
 * followed (alphabetically) by every extra currency the provider returned.
 * Bundled entries keep their names/symbols; codes the provider lacks keep
 * their bundled approximate rate. Without live data → bundle only.
 */
export function getEffectiveCurrencies(
	live: Record<string, number> | null,
	table: Currency[] = currencies,
): Currency[] {
	if (!live) return table;
	const known = new Set(table.map((c) => c.code));
	const bundled = table.map((c) => (live[c.code] ? { ...c, perUsd: live[c.code] } : c));
	const extra: Currency[] = Object.keys(live)
		.filter((code) => !known.has(code) && live[code] > 0)
		.sort()
		.map((code) => ({
			code,
			symbol: currencySymbols[code] ?? code,
			nameEn: currencyNames[code] ?? code,
			perUsd: live[code],
			zeroDecimals: zeroDecimalCurrencies.has(code) || undefined,
		}));
	return [...bundled, ...extra];
}

/** Date + whether it is live or the bundled snapshot. */
export function getRatesProvenance(state: Pick<RatesState, "rates" | "ratesAsOf">) {
	return state.rates && state.ratesAsOf
		? { live: true as const, asOf: state.ratesAsOf }
		: { live: false as const, asOf: bundledAsOf };
}
