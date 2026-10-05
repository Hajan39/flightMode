import type { ContentItem } from "@/types/content";

/**
 * Remote article feed: a static JSON file (`content/feed.json`) served straight
 * from the public GitHub repo — no backend, no cost. Publishing an article is a
 * commit to `content/feed.json` on `main`; it does not trigger an app release.
 */
const CONTENT_FEED_URL =
	process.env.EXPO_PUBLIC_CONTENT_FEED_URL ??
	"https://raw.githubusercontent.com/Hajan39/flightMode/main/content/feed.json";

export type ContentSyncResult = {
	version: string;
	items: ContentItem[];
};

type ContentFeed = {
	version?: unknown;
	items?: unknown;
};

export function hasContentSyncEndpoint() {
	return CONTENT_FEED_URL.length > 0;
}

export async function fetchSyncedContent(
	currentVersion: string | null,
): Promise<ContentSyncResult | null> {
	const response = await fetch(CONTENT_FEED_URL, {
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Content sync failed with status ${response.status}`);
	}

	return parseContentFeed((await response.json()) as ContentFeed, currentVersion);
}

/** Validates the feed; malformed items are dropped so one typo can't break the rest. */
export function parseContentFeed(
	feed: ContentFeed,
	currentVersion: string | null,
): ContentSyncResult | null {
	if (typeof feed.version !== "string" || !Array.isArray(feed.items)) {
		throw new Error("Content feed is malformed");
	}
	if (currentVersion === feed.version) return null;

	const items = feed.items.filter(isContentItem);
	return { version: feed.version, items };
}

function isContentItem(value: unknown): value is ContentItem {
	const item = value as ContentItem;
	return (
		typeof item?.id === "string" &&
		typeof item.readTime === "number" &&
		item.readTime > 0 &&
		hasEnglish(item.title) &&
		hasEnglish(item.category) &&
		hasEnglish(item.body) &&
		(item.image === undefined || typeof item.image === "string")
	);
}

function hasEnglish(text: unknown): boolean {
	const en = (text as Record<string, unknown> | null)?.en;
	return typeof en === "string" && en.trim().length > 0;
}
