import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { ContentItem } from "@/types/content";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { fetchSyncedContent, hasContentSyncEndpoint } from "@/utils/contentSync";

const CONTENT_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

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
			items: null,
			version: null,
			lastSyncAt: null,
			status: "idle",
			lastError: null,
			syncContent: async () => {
				const state = get();
				const networkState = useNetworkStore.getState();
				const syncNetworkPolicy =
					useSettingsStore.getState().syncNetworkPolicy;

				if (
					!hasContentSyncEndpoint() ||
					!canSyncOnNetwork(networkState, syncNetworkPolicy)
				) {
					set({ status: "skipped", lastError: null });
					return;
				}

				if (
					state.lastSyncAt &&
					Date.now() - state.lastSyncAt < CONTENT_SYNC_MIN_INTERVAL_MS
				) {
					set({ status: "skipped", lastError: null });
					return;
				}

				set({ status: "syncing", lastError: null });
				captureAnalyticsEvent("content_sync_start", {
					current_version: state.version,
					sync_network_policy: syncNetworkPolicy,
				});

				try {
					const result = await fetchSyncedContent(state.version);

					if (!result) {
						set({
							status: "success",
							lastSyncAt: Date.now(),
							lastError: null,
						});
						captureAnalyticsEvent("content_sync_success", {
							changed: false,
							content_version: state.version,
						});
						return;
					}

					set({
						items: result.items,
						version: result.version,
						lastSyncAt: Date.now(),
						status: "success",
						lastError: null,
					});
					captureAnalyticsEvent("content_sync_success", {
						changed: true,
						content_version: result.version,
						item_count: result.items.length,
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "Unknown content sync error";
					set({ status: "error", lastError: message });
					captureAnalyticsEvent("content_sync_failed", { reason: message });
				}
			},
			clearSyncedContent: () =>
				set({
					items: null,
					version: null,
					lastSyncAt: null,
					status: "idle",
					lastError: null,
				}),
		}),
		{
			name: "content_sync",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: (state) => ({
				items: state.items,
				version: state.version,
				lastSyncAt: state.lastSyncAt,
			}),
		},
	),
);
