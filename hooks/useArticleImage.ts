import { useImageCacheStore } from "@/store/useImageCacheStore";
import { useNetworkStore } from "@/store/useNetworkStore";

type ImageSource = { uri: string } | null;

export function useArticleImage(imageUrl?: string): ImageSource {
	const cache = useImageCacheStore((s) => s.cache);
	const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);

	if (!imageUrl) return null;

	// Locally cached — always available, even offline
	if (cache[imageUrl]) return { uri: cache[imageUrl] };

	// Fall back to remote URL when online (image not yet cached)
	if (isInternetReachable) return { uri: imageUrl };

	return null;
}
