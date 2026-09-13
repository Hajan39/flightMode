import { useMemo } from "react";

import bundledContent from "@/data/content.json";
import type { Language } from "@/i18n/translations";
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

/** True when the article is fully available (title, category, body) in `language`. */
export function hasLanguage(item: ContentItem, language: Language): boolean {
	if (language === "en") return true;
	return Boolean(
		item.title[language] && item.category[language] && item.body[language],
	);
}

/**
 * Language the article will actually be rendered in: the active language when
 * it is available, otherwise English (the guaranteed baseline of every item).
 */
export function getArticleDisplayLanguage(
	item: ContentItem,
	language: Language,
): Language {
	return hasLanguage(item, language) ? language : "en";
}
