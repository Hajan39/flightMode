import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type ChecklistSectionId, defaultItemIds } from "@/data/checklist";
import { getDestinationById } from "@/data/destinations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export const MAX_CUSTOM_ITEM_LENGTH = 60;

export type CustomChecklistItem = {
	id: string;
	sectionId: ChecklistSectionId;
	label: string;
};

export type ChecklistResetReason = "new_flight" | "manual";

type ChecklistState = {
	/** Flight the current tick state belongs to (null = no flight yet). */
	flightId: string | null;
	checkedIds: string[];
	/** User-added items — survive resets, they are the traveller's personal list. */
	customItems: CustomChecklistItem[];
	/** Guards the "completed" achievement so a flight counts only once. */
	completedFlightId: string | null;
	toggleItem: (id: string) => void;
	addCustomItem: (sectionId: ChecklistSectionId, label: string) => void;
	removeCustomItem: (id: string) => void;
	resetForFlight: (
		flightId: string | null,
		reason: ChecklistResetReason,
	) => void;
};

type ProgressInput = Pick<ChecklistState, "checkedIds" | "customItems">;

/** Stable id for a destination-specific item (derived from the flight, not stored). */
export function destinationItemId(labelKey: string) {
	return `dest-${labelKey}`;
}

/**
 * `{ done, total }` over default + destination + custom items. `extraIds` comes
 * from the current flight's destination, so it changes with the flight.
 */
export function getChecklistProgress(state: ProgressInput, extraIds: string[] = []) {
	const allIds = new Set([
		...defaultItemIds,
		...extraIds,
		...state.customItems.map((item) => item.id),
	]);
	const done = state.checkedIds.filter((id) => allIds.has(id)).length;
	return { done, total: allIds.size };
}

export function isChecklistComplete(state: ProgressInput, extraIds: string[] = []) {
	const { done, total } = getChecklistProgress(state, extraIds);
	return total > 0 && done >= total;
}

/**
 * Checklist item ids contributed by the current flight's destination.
 * Derived from the flight store so every caller (Home, Preflight, the store
 * itself) counts the same set.
 */
export function getCurrentDestinationItemIds(): string[] {
	const destinationId = useFlightStore.getState().flight?.destinationId;
	const destination = destinationId ? getDestinationById(destinationId) : undefined;
	return (destination?.checklistExtras ?? []).map(destinationItemId);
}

export const useChecklistStore = create<ChecklistState>()(
	persist(
		(set, get) => ({
			flightId: null,
			checkedIds: [],
			customItems: [],
			completedFlightId: null,

			toggleItem: (id) => {
				const state = get();
				const checked = state.checkedIds.includes(id);
				const nextChecked = checked
					? state.checkedIds.filter((x) => x !== id)
					: [...state.checkedIds, id];
				set({ checkedIds: nextChecked });

				const isCustom = state.customItems.some((item) => item.id === id);
				captureAnalyticsEvent("checklist_item_toggled", {
					checked: !checked,
					is_custom: isCustom,
				});

				const next = get();
				if (
					!checked &&
					isChecklistComplete(next, getCurrentDestinationItemIds()) &&
					next.completedFlightId !== next.flightId
				) {
					set({ completedFlightId: next.flightId });
					useAchievementStore.getState().incrementChecklistsCompleted();
					captureAnalyticsEvent("checklist_completed", {
						custom_count: next.customItems.length,
					});
				}
			},

			addCustomItem: (sectionId, label) => {
				const trimmed = label.trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
				if (trimmed.length === 0) return;
				const id = `custom-${Date.now().toString(36)}-${Math.random()
					.toString(36)
					.slice(2, 6)}`;
				set((state) => ({
					customItems: [...state.customItems, { id, sectionId, label: trimmed }],
				}));
				captureAnalyticsEvent("checklist_custom_added", { section: sectionId });
			},

			removeCustomItem: (id) => {
				set((state) => ({
					customItems: state.customItems.filter((item) => item.id !== id),
					checkedIds: state.checkedIds.filter((x) => x !== id),
				}));
			},

			resetForFlight: (flightId, reason) => {
				set({ flightId, checkedIds: [], completedFlightId: null });
				captureAnalyticsEvent("checklist_reset", { reason });
			},
		}),
		{
			name: "checklist",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
