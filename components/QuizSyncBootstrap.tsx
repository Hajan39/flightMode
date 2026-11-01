import { useEffect } from "react";

import { useTranslation } from "@/hooks/useTranslation";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useQuizPackStore } from "@/store/useQuizPackStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePersistHydrated } from "@/utils/hydration";
import { isQuizRemoteLanguage } from "@/utils/quizSync";

/**
 * Downloads extra world-quiz packs for the app language (en/cs/de) when the
 * network is usable under the Online Sync policy. 24 h cooldown inside the
 * store; never blocks gameplay (the quiz always has the bundled questions).
 */
export default function QuizSyncBootstrap() {
  const { language } = useTranslation();
  const networkType = useNetworkStore((s) => s.type);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const _checkedAt = useNetworkStore((s) => s.checkedAt);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const status = useQuizPackStore((s) => s.status);
  const syncQuizPacks = useQuizPackStore((s) => s.syncQuizPacks);
  // Cooldown / ETag / stored language and the sync policy must be the
  // persisted values, not defaults.
  const ready = usePersistHydrated(useQuizPackStore, useSettingsStore);

  useEffect(() => {
    if (
      !(
        ready &&
        isQuizRemoteLanguage(language) &&
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
    void syncQuizPacks(language);
  }, [
    ready,
    language,
    networkType,
    isInternetReachable,
    syncNetworkPolicy,
    status,
    syncQuizPacks,
  ]);

  return null;
}
