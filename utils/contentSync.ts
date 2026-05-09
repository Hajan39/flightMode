import type { LocalizedText } from "@/i18n/translations";
import type { ContentItem } from "@/types/content";

const SANITY_PROJECT_ID = process.env.EXPO_PUBLIC_SANITY_PROJECT_ID;
const SANITY_DATASET = process.env.EXPO_PUBLIC_SANITY_DATASET ?? "production";

const SANITY_GROQ = `*[_type == "article"] | order(_updatedAt desc) {
  _id,
  _updatedAt,
  rawSlug,
  locale,
  title,
  articleType,
  readTime,
  "body": pt::text(content),
  "image": image.asset->url
}`;

export type ContentSyncResult = {
	version: string;
	items: ContentItem[];
};

type SanityArticleDoc = {
	_id: string;
	_updatedAt: string;
	rawSlug?: string | null;
	locale?: string | null;
	title?: string | null;
	articleType?: string | null;
	readTime?: number | null;
	body?: string | null;
	image?: string | null;
};

type SanityQueryResult = {
	result: SanityArticleDoc[];
};

export function hasContentSyncEndpoint() {
	return Boolean(SANITY_PROJECT_ID);
}

export async function fetchSyncedContent(
	currentVersion: string | null,
): Promise<ContentSyncResult | null> {
	if (!SANITY_PROJECT_ID) return null;

	const url = `https://${SANITY_PROJECT_ID}.apicdn.sanity.io/v2021-10-21/data/query/${SANITY_DATASET}?query=${encodeURIComponent(SANITY_GROQ)}`;

	const response = await fetch(url, {
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(`Content sync failed with status ${response.status}`);
	}

	const { result: docs } = (await response.json()) as SanityQueryResult;

	if (!Array.isArray(docs) || docs.length === 0) return null;

	const newVersion = docs[0]?._updatedAt ?? String(Date.now());
	if (currentVersion && currentVersion === newVersion) return null;

	const items = normalizeSanityDocs(docs);
	if (items.length === 0) return null;

	return { version: newVersion, items };
}

function normalizeSanityDocs(docs: SanityArticleDoc[]): ContentItem[] {
	const groups = new Map<string, SanityArticleDoc[]>();

	for (const doc of docs) {
		const key = doc.rawSlug ?? doc._id;
		const group = groups.get(key);
		if (group) {
			group.push(doc);
		} else {
			groups.set(key, [doc]);
		}
	}

	const items: ContentItem[] = [];
	for (const [key, group] of groups) {
		const item = buildContentItem(key, group);
		if (item) items.push(item);
	}
	return items;
}

function buildContentItem(
	key: string,
	group: SanityArticleDoc[],
): ContentItem | null {
	const byLocale = new Map(group.map((doc) => [doc.locale ?? "en", doc]));
	const primary = byLocale.get("en") ?? group[0];
	if (!primary) return null;

	const title = mergeLocalizedField(byLocale, (doc) => doc.title);
	const body = mergeLocalizedField(byLocale, (doc) => doc.body);

	if (!title || !body) return null;

	const readTime =
		primary.readTime ??
		group.find((d) => d.readTime != null)?.readTime ??
		estimateReadTime(primary.body ?? "");

	const category: LocalizedText = {
		en: primary.articleType ?? "article",
	};

	const image = group.find((d) => d.image)?.image ?? undefined;

	return { id: key, title, category, readTime, body, ...(image ? { image } : {}) };
}

function mergeLocalizedField(
	byLocale: Map<string, SanityArticleDoc>,
	getValue: (doc: SanityArticleDoc) => string | null | undefined,
): LocalizedText | null {
	const entries: Record<string, string> = {};

	for (const [locale, doc] of byLocale) {
		const value = getValue(doc);
		if (value && value.trim().length > 0) {
			entries[locale] = value.trim();
		}
	}

	if (!entries.en) {
		const fallback = Object.values(entries)[0];
		if (!fallback) return null;
		entries.en = fallback;
	}

	return entries as LocalizedText;
}

function estimateReadTime(text: string): number {
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}
