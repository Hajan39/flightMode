import type { LocalizedText } from "@/i18n/translations";
import type { ContentItem } from "@/types/content";

const STRAPI_CONTENT_URL = process.env.EXPO_PUBLIC_STRAPI_CONTENT_URL;
const GENERIC_CONTENT_SYNC_URL = process.env.EXPO_PUBLIC_CONTENT_SYNC_URL;
const CONTENT_SYNC_URL = STRAPI_CONTENT_URL ?? GENERIC_CONTENT_SYNC_URL;

export type ContentSyncResult = {
	version: string;
	items: ContentItem[];
};

type RemoteContentPayload = {
	version?: unknown;
	items?: unknown;
	articles?: unknown;
	data?: unknown;
	meta?: { version?: unknown; pagination?: unknown };
};

type RemoteContentItem = {
	id?: unknown;
	documentId?: unknown;
	attributes?: Record<string, unknown>;
	title?: unknown;
	category?: unknown;
	readTime?: unknown;
	read_time?: unknown;
	body?: unknown;
	updatedAt?: unknown;
	publishedAt?: unknown;
	createdAt?: unknown;
};

export function hasContentSyncEndpoint() {
	return Boolean(CONTENT_SYNC_URL);
}

export async function fetchSyncedContent(
	currentVersion: string | null,
): Promise<ContentSyncResult | null> {
	if (!CONTENT_SYNC_URL) return null;

	const url = buildContentSyncUrl(CONTENT_SYNC_URL);
	if (currentVersion) {
		url.searchParams.set("currentVersion", currentVersion);
	}

	const response = await fetch(url.toString(), {
		headers: { Accept: "application/json" },
	});

	if (response.status === 304) return null;

	if (!response.ok) {
		throw new Error(`Content sync failed with status ${response.status}`);
	}

	return normalizeContentPayload((await response.json()) as RemoteContentPayload);
}

export function normalizeContentPayload(
	payload: RemoteContentPayload,
): ContentSyncResult | null {
	const rawItems = getRawItems(payload);
	const items = rawItems.map(normalizeContentItem).filter(Boolean) as ContentItem[];

	if (items.length === 0) {
		return null;
	}

	const version =
		stringOrNull(payload.version) ??
		stringOrNull(payload.meta?.version) ??
		getLatestItemVersion(rawItems) ??
		String(Date.now());

	return { version, items };
}

function buildContentSyncUrl(value: string) {
	const url = new URL(value);

	if (STRAPI_CONTENT_URL) {
		const normalizedPath = url.pathname.replace(/\/+$/, "");

		if (normalizedPath === "" || normalizedPath === "/api") {
			url.pathname = "/api/articles";
		}

		if (!url.searchParams.has("pagination[pageSize]")) {
			url.searchParams.set("pagination[pageSize]", "100");
		}

		if (!url.searchParams.has("sort")) {
			url.searchParams.set("sort", "updatedAt:desc");
		}
	}

	return url;
}

function getRawItems(payload: RemoteContentPayload): RemoteContentItem[] {
	const source = payload.items ?? payload.articles ?? payload.data;

	if (!Array.isArray(source)) {
		throw new Error("Content sync response must include an items array");
	}

	return source as RemoteContentItem[];
}

function normalizeContentItem(item: RemoteContentItem) {
	const source = item.attributes ?? item;
	const id = idOrNull(item.id) ?? idOrNull(item.documentId) ?? idOrNull(source.id);
	const title = normalizeLocalizedText(source.title);
	const category = normalizeLocalizedText(source.category);
	const body = normalizeLocalizedText(source.body);
	const readTime = numberOrNull(source.readTime) ?? numberOrNull(source.read_time);

	if (!id || !title || !category || !body || !readTime) return null;

	return { id, title, category, readTime, body };
}

function getLatestItemVersion(items: RemoteContentItem[]) {
	const timestamps = items
		.map((item) => {
			const source = item.attributes ?? item;
			return (
				stringOrNull(source.updatedAt) ??
				stringOrNull(source.publishedAt) ??
				stringOrNull(source.createdAt)
			);
		})
		.filter((value): value is string => Boolean(value));

	return timestamps[0] ?? null;
}

function normalizeLocalizedText(value: unknown): LocalizedText | null {
	if (typeof value === "string" && value.trim().length > 0) {
		return { en: value };
	}

	if (!value || typeof value !== "object") return null;

	const entries = Object.entries(value).filter(
		(entry): entry is [string, string] =>
			typeof entry[1] === "string" && entry[1].trim().length > 0,
	);

	const localized = Object.fromEntries(entries) as Partial<LocalizedText>;

	if (!localized.en) return null;

	return localized as LocalizedText;
}

function stringOrNull(value: unknown) {
	return typeof value === "string" && value.trim().length > 0
		? value
		: null;
}

function idOrNull(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}

	return stringOrNull(value);
}

function numberOrNull(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}

	return null;
}
