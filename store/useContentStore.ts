import { create } from "zustand";
import { persist } from "zustand/middleware";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { ContentItem } from "@/types/content";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  fetchContentFeed,
  hasContentSyncEndpoint,
  isContentItem,
} from "@/utils/contentSync";
import { sanitizeErrorText } from "@/utils/errorLogging";
import { fileStorage } from "@/utils/fileStorage";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";

const CONTENT_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;
/** After a failure, wait before retrying — the bootstrap effect re-runs on every status change. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
let lastFailureAt = 0;

type ContentSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

interface ContentState {
  clearSyncedContent: () => void;
  /** ETag of the last feed response (conditional requests). */
  etag: string | null;
  items: ContentItem[] | null;
  lastError: string | null;
  /** Last-Modified of the last feed response (conditional requests). */
  lastModified: string | null;
  lastSyncAt: number | null;
  status: ContentSyncStatus;
  syncContent: () => Promise<void>;
  version: string | null;
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      clearSyncedContent: () =>
        set({
          etag: null,
          items: null,
          lastError: null,
          lastModified: null,
          lastSyncAt: null,
          status: "idle",
          version: null,
        }),
      etag: null,
      items: null,
      lastError: null,
      lastModified: null,
      lastSyncAt: null,
      status: "idle",
      syncContent: async () => {
        // Before hydration lastSyncAt / version / ETag are still null and the
        // sync policy is the default: syncing now would ignore the cooldown,
        // re-download the whole feed and could break a user's "off" choice.
        // The bootstrap retries once both stores have loaded.
        if (!syncInputsHydrated()) {
          return;
        }
        const state = get();
        const networkState = useNetworkStore.getState();
        const { syncNetworkPolicy } = useSettingsStore.getState();

        if (!canSyncNow(networkState, syncNetworkPolicy)) {
          set({ lastError: null, status: "skipped" });
          return;
        }

        if (isCoolingDown(state.lastSyncAt)) {
          set({ lastError: null, status: "skipped" });
          return;
        }

        if (Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
          return;
        }

        set({ lastError: null, status: "syncing" });
        captureAnalyticsEvent("content_sync_start", {
          current_version: state.version,
          sync_network_policy: syncNetworkPolicy,
        });

        try {
          // Validators only while a synced feed is cached: a 304 means "keep
          // what you have", which needs something to keep.
          const outcome = await fetchContentFeed(
            state.version,
            state.version === null
              ? null
              : { etag: state.etag, lastModified: state.lastModified }
          );
          const { result, validators } = outcome;

          if (!result) {
            set({
              etag: validators.etag,
              lastError: null,
              lastModified: validators.lastModified,
              lastSyncAt: Date.now(),
              status: "success",
            });
            captureAnalyticsEvent("content_sync_success", {
              changed: false,
              content_version: state.version,
              not_modified: outcome.notModified,
            });
            return;
          }

          set({
            etag: validators.etag,
            items: result.items,
            lastError: null,
            lastModified: validators.lastModified,
            lastSyncAt: Date.now(),
            status: "success",
            version: result.version,
          });
          captureAnalyticsEvent("content_sync_success", {
            changed: true,
            content_version: result.version,
            item_count: result.items.length,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown content sync error";
          lastFailureAt = Date.now();
          set({ lastError: message, status: "error" });
          captureAnalyticsEvent("content_sync_failed", {
            error_name: error instanceof Error ? error.name : "unknown",
            reason: sanitizeErrorText(message),
          });
        }
      },
      version: null,
    }),
    safePersistOptions(() => fileStorage, {
      // A hand-edited / older-format file must not crash consumers: keep
      // only valid articles; a non-array means "no synced feed".
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<ContentState>;
        return {
          ...current,
          ...stored,
          items:
            "items" in stored ? sanitizeItems(stored.items) : current.items,
        };
      },
      name: "content_sync",
      partialize: (state) => ({
        etag: state.etag,
        items: state.items,
        lastModified: state.lastModified,
        lastSyncAt: state.lastSyncAt,
        version: state.version,
      }),
      // The feed can grow past what Android AsyncStorage can hold — keep it
      // in a file (fileStorage, chosen above).
    })
  )
);
enablePersistRecovery(useContentStore);

function sanitizeItems(items: unknown): ContentItem[] | null {
  return Array.isArray(items) ? items.filter(isContentItem) : null;
}

/** Cooldown timestamps and the sync policy are only real once both stores loaded. */
function syncInputsHydrated() {
  return (
    useContentStore.persist.hasHydrated() &&
    useSettingsStore.persist.hasHydrated()
  );
}

function canSyncNow(
  networkState: Parameters<typeof canSyncOnNetwork>[0],
  policy: Parameters<typeof canSyncOnNetwork>[1]
) {
  return hasContentSyncEndpoint() && canSyncOnNetwork(networkState, policy);
}

function isCoolingDown(lastSyncAt: number | null) {
  return (
    lastSyncAt !== null &&
    Date.now() - lastSyncAt < CONTENT_SYNC_MIN_INTERVAL_MS
  );
}
