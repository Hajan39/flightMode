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

/** HTTP cache validators of the last feed response (persisted by the store). */
export interface FeedValidators {
  etag: string | null;
  lastModified: string | null;
}

export interface ContentFeedOutcome {
  /** 304 Not Modified: nothing was downloaded. */
  notModified: boolean;
  /** New feed content, or null when unchanged (same version or 304). */
  result: ContentSyncResult | null;
  /** Validators to send next time (kept from the request on a 304). */
  validators: FeedValidators;
}

interface ContentFeed {
  items?: unknown;
  version?: unknown;
}

export function hasContentSyncEndpoint() {
  return CONTENT_FEED_URL.length > 0;
}

/**
 * Until response headers arrive — same budget as the rates fetch: a captive
 * portal must not hang "Refreshing…".
 */
export const CONTENT_FEED_HEADER_TIMEOUT_MS = 8000;
/** @deprecated alias of `CONTENT_FEED_HEADER_TIMEOUT_MS`. */
export const CONTENT_FEED_TIMEOUT_MS = CONTENT_FEED_HEADER_TIMEOUT_MS;
/**
 * After headers: the body (a multi-MB feed) on slow airport / in-flight Wi-Fi.
 * RN fetch exposes no progress, so this is a total body budget.
 */
export const CONTENT_FEED_BODY_TIMEOUT_MS = 45_000;

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

/** Back-compat wrapper: the new content, or null when unchanged. */
export async function fetchSyncedContent(
  currentVersion: string | null,
  fetchImpl: typeof fetch = fetch,
  validators?: FeedValidators | null
): Promise<ContentSyncResult | null> {
  const outcome = await fetchContentFeed(currentVersion, validators, fetchImpl);
  return outcome.result;
}

/**
 * Fetches the feed with a conditional request (If-None-Match /
 * If-Modified-Since from `validators`). A 304 downloads nothing.
 */
export async function fetchContentFeed(
  currentVersion: string | null,
  validators: FeedValidators | null | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<ContentFeedOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout: (error: Error) => void = () => undefined;
  // Race as well as abort: a fetch implementation that ignores the signal
  // (or a body that never finishes) still settles.
  const timeout = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
  });
  const arm = (ms: number, phase: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort();
      rejectTimeout(new Error(`Content sync timed out (${phase})`));
    }, ms);
  };

  const headers: Record<string, string> = { Accept: "application/json" };
  if (validators?.etag) {
    headers["If-None-Match"] = validators.etag;
  }
  if (validators?.lastModified) {
    headers["If-Modified-Since"] = validators.lastModified;
  }

  arm(CONTENT_FEED_HEADER_TIMEOUT_MS, "headers");
  try {
    return await Promise.race([
      (async (): Promise<ContentFeedOutcome> => {
        const response = await fetchImpl(CONTENT_FEED_URL, {
          headers,
          signal: controller.signal,
        });

        if (response.status === 304) {
          clearTimeout(timer);
          return {
            notModified: true,
            result: null,
            validators: {
              etag: response.headers.get("etag") ?? validators?.etag ?? null,
              lastModified:
                response.headers.get("last-modified") ??
                validators?.lastModified ??
                null,
            },
          };
        }
        if (!response.ok) {
          throw new Error(`Content sync failed with status ${response.status}`);
        }
        if (
          !isAcceptableFeedContentType(response.headers.get("content-type"))
        ) {
          throw new Error("Content feed is not JSON");
        }

        arm(CONTENT_FEED_BODY_TIMEOUT_MS, "body");
        let feed: unknown;
        try {
          feed = await response.json();
        } catch (error) {
          throw new Error("Content feed is not JSON", { cause: error });
        }
        return {
          notModified: false,
          result: parseContentFeed((feed ?? {}) as ContentFeed, currentVersion),
          validators: {
            etag: response.headers.get("etag"),
            lastModified: response.headers.get("last-modified"),
          },
        };
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

export function isContentItem(value: unknown): value is ContentItem {
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
