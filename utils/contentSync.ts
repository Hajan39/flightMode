import type { ContentItem } from "@/types/content";

/**
 * Remote article feed: a static JSON file (`content/feed.json`) served straight
 * from the public GitHub repo — no backend, no cost. Publishing an article is a
 * commit to `content/feed.json` on `main`; it does not trigger an app release.
 */
const CONTENT_FEED_URL =
  process.env.EXPO_PUBLIC_CONTENT_FEED_URL ??
  "https://raw.githubusercontent.com/Hajan39/flightMode/main/content/feed.json";

export interface ContentSyncResult {
  items: ContentItem[];
  version: string;
}

interface ContentFeed {
  items?: unknown;
  version?: unknown;
}

export function hasContentSyncEndpoint() {
  return CONTENT_FEED_URL.length > 0;
}

/** Same budget as the rates fetch: a captive portal must not hang "Refreshing…". */
export const CONTENT_FEED_TIMEOUT_MS = 8000;

/**
 * raw.githubusercontent.com serves `.json` as `text/plain`, so plain text is
 * accepted; HTML (captive-portal login pages) and other types are not.
 */
export function isAcceptableFeedContentType(contentType: string | null) {
  if (!contentType) {
    return true;
  }
  const type = contentType.split(";")[0].trim().toLowerCase();
  return (
    type === "application/json" ||
    type.endsWith("+json") ||
    type === "text/plain" ||
    type === "text/json"
  );
}

export async function fetchSyncedContent(
  currentVersion: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<ContentSyncResult | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Race as well as abort: a fetch implementation that ignores the signal
  // (or a body that never finishes) still settles.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Content sync timed out"));
    }, CONTENT_FEED_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(CONTENT_FEED_URL, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Content sync failed with status ${response.status}`);
        }
        if (
          !isAcceptableFeedContentType(response.headers.get("content-type"))
        ) {
          throw new Error("Content feed is not JSON");
        }

        let feed: unknown;
        try {
          feed = await response.json();
        } catch (error) {
          throw new Error("Content feed is not JSON", { cause: error });
        }
        return parseContentFeed((feed ?? {}) as ContentFeed, currentVersion);
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Validates the feed; malformed items are dropped so one typo can't break the rest. */
export function parseContentFeed(
  feed: ContentFeed,
  currentVersion: string | null
): ContentSyncResult | null {
  if (typeof feed.version !== "string" || !Array.isArray(feed.items)) {
    throw new Error("Content feed is malformed");
  }
  if (currentVersion === feed.version) {
    return null;
  }

  const items = feed.items.filter(isContentItem);
  return { items, version: feed.version };
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
