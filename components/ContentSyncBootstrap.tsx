import { useEffect } from "react";

import { useContentStore } from "@/store/useContentStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";

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

  useEffect(() => {
    if (
      !canSyncOnNetwork(
        { isInternetReachable, type: networkType },
        syncNetworkPolicy
      ) ||
      status === "syncing"
    ) {
      return;
    }

    void syncContent();
  }, [
    networkType,
    isInternetReachable,
    syncNetworkPolicy,
    status,
    syncContent,
  ]);

  return null;
}
