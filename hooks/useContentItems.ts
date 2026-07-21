import { useMemo } from "react";

import bundledContent from "@/data/content.json";
import { useContentStore } from "@/store/useContentStore";
import type { ContentItem } from "@/types/content";

const bundledItems = bundledContent as ContentItem[];

/**
 * Bundled articles merged with the optional remote sync cache: remote items
 * override bundled ones with the same id and add any new ones, while bundled
 * articles that the remote set omits are preserved (so a partial/empty remote
 * response can never make offline content vanish).
 */
export function useContentItems() {
	const remote = useContentStore((state) => state.items);
	return useMemo(() => {
		if (!remote || remote.length === 0) return bundledItems;
		const byId = new Map<string, ContentItem>(
			bundledItems.map((item) => [item.id, item]),
		);
		for (const item of remote) byId.set(item.id, item);
		return Array.from(byId.values());
	}, [remote]);
}

export function getBundledContentItems() {
	return bundledItems;
}
