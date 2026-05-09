import { useEffect, useRef } from "react";

import { useImageCacheStore } from "@/store/useImageCacheStore";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useContentItems } from "@/hooks/useContentItems";
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
		if (!canSyncOnNetwork({ type: networkType, isInternetReachable }, syncNetworkPolicy)) return;

		const pending = items
			.filter((item) => item.image && !cache[item.image])
			.map((item) => item.image as string);

		if (pending.length === 0) return;

		cancelledRef.current = false;

		void (async () => {
			for (const url of pending) {
				if (cancelledRef.current) break;
				try {
					const localUri = await downloadImage(url);
					if (localUri) setCached(url, localUri);
				} catch {}
			}
		})();

		return () => {
			cancelledRef.current = true;
		};
	}, [items, networkType, isInternetReachable, syncNetworkPolicy, cache, setCached]);

	return null;
}
