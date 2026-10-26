import { useEffect } from "react";

import { useContentStore } from "@/store/useContentStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePersistHydrated } from "@/utils/hydration";

export default function ContentSyncBootstrap() {
  const networkType = useNetworkStore((state) => state.type);
  const isInternetReachable = useNetworkStore(
    (state) => state.isInternetReachable
  );
  const _checkedAt = useNetworkStore((state) => state.checkedAt);
  const syncNetworkPolicy = useSettingsStore(
    (state) => state.syncNetworkPolicy
  );
  const status = useContentStore((state) => state.status);
  const syncContent = useContentStore((state) => state.syncContent);
  // Cooldown / ETag (content store) and the sync policy (settings) must be
  // the persisted values: the 2.5 MB feed file can take a while to load.
  const ready = usePersistHydrated(useContentStore, useSettingsStore);

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
    void syncContent();
  }, [
    ready,
    networkType,
    isInternetReachable,
    syncNetworkPolicy,
    status,
    syncContent,
  ]);

  return null;
}
