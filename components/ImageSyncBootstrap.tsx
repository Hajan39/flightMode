import { useEffect, useRef } from "react";
import { useContentItems } from "@/hooks/useContentItems";
import { useImageCacheStore } from "@/store/useImageCacheStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { downloadImage } from "@/utils/imageSync";

export default function ImageSyncBootstrap() {
  const items = useContentItems();
  const cache = useImageCacheStore((s) => s.cache);
  const setCached = useImageCacheStore((s) => s.setCached);
  const networkType = useNetworkStore((s) => s.type);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (
      !canSyncOnNetwork(
        { isInternetReachable, type: networkType },
        syncNetworkPolicy
      )
    ) {
      return;
    }

    const pending = items
      .filter((item) => item.image && !cache[item.image])
      .map((item) => item.image as string);

    if (pending.length === 0) {
      return;
    }

    cancelledRef.current = false;

    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void (async () => {
      for (const url of pending) {
        // biome-ignore lint/suspicious/noUnnecessaryConditions: the effect cleanup flips this ref while the async loop runs
        if (cancelledRef.current) {
          break;
        }
        try {
          // biome-ignore lint/performance/noAwaitInLoops: downloads run sequentially on purpose to be gentle on in-flight networks
          const localUri = await downloadImage(url);
          if (localUri) {
            setCached(url, localUri);
          }
        } catch {
          // Ignore: a failed image download is non-fatal; the article renders without it.
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [
    items,
    networkType,
    isInternetReachable,
    syncNetworkPolicy,
    cache,
    setCached,
  ]);

  return null;
}
