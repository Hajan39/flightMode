import { cachedImageUri, useImageCacheStore } from "@/store/useImageCacheStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { isAllowedImageUrl } from "@/utils/imageSync";

type ImageSource = { uri: string } | null;

export function useArticleImage(imageUrl?: string): ImageSource {
  const cache = useImageCacheStore((s) => s.cache);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const networkType = useNetworkStore((s) => s.type);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);

  if (!imageUrl) {
    return null;
  }

  // Locally cached — always available, even offline. The store keeps only
  // the file name; the container path is rebuilt for this install.
  const cachedName = cache[imageUrl];
  const localUri = cachedName ? cachedImageUri(cachedName) : null;
  if (localUri) {
    return { uri: localUri };
  }

  // Not cached yet: load it remotely only where the sync policy allows
  // network use (wifi_only → Wi-Fi/Ethernet, off → never) and only over https.
  if (
    isAllowedImageUrl(imageUrl) &&
    canSyncOnNetwork(
      { isInternetReachable, type: networkType },
      syncNetworkPolicy
    )
  ) {
    return { uri: imageUrl };
  }

  return null;
}
