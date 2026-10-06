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

interface NetworkState {
  checkedAt: number | null;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  setNetworkState: (state: {
    type?: NetworkConnectionType;
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
  }) => void;
  type: NetworkConnectionType;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  checkedAt: null,
  isConnected: null,
  isInternetReachable: null,
  setNetworkState: (state) =>
    set({
      checkedAt: Date.now(),
      isConnected: state.isConnected ?? null,
      isInternetReachable: state.isInternetReachable ?? null,
      type: state.type ?? "UNKNOWN",
    }),
  type: "UNKNOWN",
}));

export function isNetworkUsable(
  state: Pick<NetworkState, "isInternetReachable">
) {
  return state.isInternetReachable === true;
}

export function canSyncOnNetwork(
  state: Pick<NetworkState, "isInternetReachable" | "type">,
  policy: SyncNetworkPolicy
) {
  if (policy === "off" || !isNetworkUsable(state)) {
    return false;
  }

  if (policy === "wifi_only") {
    return state.type === "WIFI" || state.type === "ETHERNET";
  }

  return true;
}
