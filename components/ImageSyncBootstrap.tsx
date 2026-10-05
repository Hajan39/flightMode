import { useEffect } from "react";

import { useImageCacheStore } from "@/store/useImageCacheStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useContentItems } from "@/hooks/useContentItems";
import { downloadImage } from "@/utils/imageSync";

/** URLs that failed this session — retried on the next app launch, not in a loop. */
const failedUrls = new Set<string>();

export default function ImageSyncBootstrap() {
	const items = useContentItems();
	const networkType = useNetworkStore((s) => s.type);
	const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
	const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);

	useEffect(() => {
		if (!canSyncOnNetwork({ type: networkType, isInternetReachable }, syncNetworkPolicy)) return;

		// Read the cache imperatively: depending on it would restart this effect
		// after every download and pile up concurrent download loops.
		const { cache, setCached } = useImageCacheStore.getState();
		const pending = [
			...new Set(
				items
					.map((item) => item.image)
					.filter((url): url is string => !!url && !cache[url] && !failedUrls.has(url)),
			),
		];
		if (pending.length === 0) return;

		let cancelled = false; // per run, so a newer run can't revive an old one
		void (async () => {
			for (const url of pending) {
				if (cancelled) break;
				try {
					const localUri = await downloadImage(url);
					if (localUri) setCached(url, localUri);
					else failedUrls.add(url);
				} catch {
					failedUrls.add(url);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [items, networkType, isInternetReachable, syncNetworkPolicy]);

	return null;
}
