import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { ContentItem } from "@/types/content";
import { captureAnalyticsEvent } from "@/utils/analytics";
import {
  fetchSyncedContent,
  hasContentSyncEndpoint,
} from "@/utils/contentSync";
import { fileStorage } from "@/utils/fileStorage";

const CONTENT_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;
/** After a failure, wait before retrying — the bootstrap effect re-runs on every status change. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
let lastFailureAt = 0;

type ContentSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

type ContentState = {
  items: ContentItem[] | null;
  version: string | null;
  lastSyncAt: number | null;
  status: ContentSyncStatus;
  lastError: string | null;
  syncContent: () => Promise<void>;
  clearSyncedContent: () => void;
};

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      clearSyncedContent: () =>
        set({
          items: null,
          lastError: null,
          lastSyncAt: null,
          status: "idle",
          version: null,
        }),
      items: null,
      lastError: null,
      lastSyncAt: null,
      status: "idle",
      syncContent: async () => {
        const state = get();
        const networkState = useNetworkStore.getState();
        const syncNetworkPolicy = useSettingsStore.getState().syncNetworkPolicy;

        if (
          !(
            hasContentSyncEndpoint() &&
            canSyncOnNetwork(networkState, syncNetworkPolicy)
          )
        ) {
          set({ lastError: null, status: "skipped" });
          return;
        }

        if (
          state.lastSyncAt &&
          Date.now() - state.lastSyncAt < CONTENT_SYNC_MIN_INTERVAL_MS
        ) {
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
          const result = await fetchSyncedContent(state.version);

          if (!result) {
            set({
              lastError: null,
              lastSyncAt: Date.now(),
              status: "success",
            });
            captureAnalyticsEvent("content_sync_success", {
              changed: false,
              content_version: state.version,
            });
            return;
          }

          set({
            items: result.items,
            lastError: null,
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
          captureAnalyticsEvent("content_sync_failed", { reason: message });
        }
      },
      version: null,
    }),
    {
      name: "content_sync",
      partialize: (state) => ({
        items: state.items,
        lastSyncAt: state.lastSyncAt,
        version: state.version,
      }),
      // The feed can grow past what Android AsyncStorage can hold — keep it in a file.
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
