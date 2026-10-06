import AsyncStorage from "@react-native-async-storage/async-storage";
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

const CONTENT_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

type ContentSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

interface ContentState {
  clearSyncedContent: () => void;
  items: ContentItem[] | null;
  lastError: string | null;
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
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
