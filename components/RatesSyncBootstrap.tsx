import { useEffect } from "react";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useRatesStore } from "@/store/useRatesStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePersistHydrated } from "@/utils/hydration";

/** Refreshes exchange rates whenever the network becomes usable (12 h cooldown inside the store). */
export default function RatesSyncBootstrap() {
  const networkType = useNetworkStore((s) => s.type);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const _checkedAt = useNetworkStore((s) => s.checkedAt);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const status = useRatesStore((s) => s.status);
  const syncRates = useRatesStore((s) => s.syncRates);
  // lastSyncAt (cooldown) and the sync policy must be the persisted values.
  const ready = usePersistHydrated(useRatesStore, useSettingsStore);

  useEffect(() => {
    if (
      !(
        ready &&
        canSyncOnNetwork(
          { isInternetReachable, type: networkType },
          syncNetworkPolicy
        )
      ) ||
      status === "syncing"
    ) {
      return;
    }
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void syncRates();
  }, [
    ready,
    networkType,
    isInternetReachable,
    syncNetworkPolicy,
    status,
    syncRates,
  ]);

  return null;
}
