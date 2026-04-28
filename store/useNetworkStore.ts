import { create } from "zustand";

import type { SyncNetworkPolicy } from "@/store/useSettingsStore";

export type NetworkConnectionType =
	| "NONE"
	| "UNKNOWN"
	| "CELLULAR"
	| "WIFI"
	| "BLUETOOTH"
	| "ETHERNET"
	| "WIMAX"
	| "VPN"
	| "OTHER";

type NetworkState = {
	type: NetworkConnectionType;
	isConnected: boolean | null;
	isInternetReachable: boolean | null;
	checkedAt: number | null;
	setNetworkState: (state: {
		type?: NetworkConnectionType;
		isConnected?: boolean | null;
		isInternetReachable?: boolean | null;
	}) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
	type: "UNKNOWN",
	isConnected: null,
	isInternetReachable: null,
	checkedAt: null,
	setNetworkState: (state) =>
		set({
			type: state.type ?? "UNKNOWN",
			isConnected: state.isConnected ?? null,
			isInternetReachable: state.isInternetReachable ?? null,
			checkedAt: Date.now(),
		}),
}));

export function isNetworkUsable(
	state: Pick<NetworkState, "isInternetReachable">,
) {
	return state.isInternetReachable === true;
}

export function canSyncOnNetwork(
	state: Pick<NetworkState, "isInternetReachable" | "type">,
	policy: SyncNetworkPolicy,
) {
	if (policy === "off" || !isNetworkUsable(state)) {
		return false;
	}

	if (policy === "wifi_only") {
		return state.type === "WIFI" || state.type === "ETHERNET";
	}

	return true;
}
