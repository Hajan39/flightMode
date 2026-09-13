import { useEffect } from "react";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useRatesStore } from "@/store/useRatesStore";
import { useSettingsStore } from "@/store/useSettingsStore";

/** Refreshes exchange rates whenever the network becomes usable (12 h cooldown inside the store). */
export default function RatesSyncBootstrap() {
	const networkType = useNetworkStore((s) => s.type);
	const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
	const checkedAt = useNetworkStore((s) => s.checkedAt);
	const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
	const status = useRatesStore((s) => s.status);
	const syncRates = useRatesStore((s) => s.syncRates);

	useEffect(() => {
		if (
			!canSyncOnNetwork({ type: networkType, isInternetReachable }, syncNetworkPolicy) ||
			status === "syncing"
		) {
			return;
		}
		void syncRates();
	}, [networkType, isInternetReachable, checkedAt, syncNetworkPolicy, status, syncRates]);

	return null;
}
