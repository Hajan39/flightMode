import { getInfoAsync } from "expo-file-system/legacy";
import { useEffect } from "react";
import { useContentItems } from "@/hooks/useContentItems";
import { cachedImageUri, useImageCacheStore } from "@/store/useImageCacheStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { usePersistHydrated } from "@/utils/hydration";
import { downloadImage, isAllowedImageUrl } from "@/utils/imageSync";

/** URLs that failed this session — retried on the next app launch, not in a loop. */
const failedUrls = new Set<string>();

/** A cache entry counts only while its file still exists (iOS can purge, updates move containers). */
async function isCachedOnDisk(fileName: string | undefined) {
  const uri = fileName ? cachedImageUri(fileName) : null;
  if (!uri) {
    return false;
  }
  try {
    return (await getInfoAsync(uri)).exists;
  } catch {
    return false;
  }
}

export default function ImageSyncBootstrap() {
  const items = useContentItems();
  const networkType = useNetworkStore((s) => s.type);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  // The sync policy and the cache must be the persisted ones, not defaults.
  const ready = usePersistHydrated(useSettingsStore, useImageCacheStore);

  useEffect(() => {
    if (
      !(
        ready &&
        canSyncOnNetwork(
          { isInternetReachable, type: networkType },
          syncNetworkPolicy
        )
      )
    ) {
      return;
    }

    const candidates = [
      ...new Set(
        items
          .map((item) => item.image)
          .filter(
            (url): url is string =>
              isAllowedImageUrl(url) && !failedUrls.has(url)
          )
      ),
    ];
    if (candidates.length === 0) {
      return;
    }

    let cancelled = false; // per run, so a newer run can't revive an old one
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void (async () => {
      for (const url of candidates) {
        if (cancelled) {
          break;
        }
        // Read the cache imperatively: depending on it would restart this
        // effect after every download and pile up concurrent download loops.
        const { cache, setCached } = useImageCacheStore.getState();
        try {
          // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — gentle on the network/disk, and cancellable between downloads
          if (await isCachedOnDisk(cache[url])) {
            continue;
          }
          const localUri = await downloadImage(url);
          if (localUri) {
            setCached(url, localUri);
          } else {
            failedUrls.add(url);
          }
        } catch {
          failedUrls.add(url);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, items, networkType, isInternetReachable, syncNetworkPolicy]);

  return null;
}
