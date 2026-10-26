import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { type ChecklistSectionId, defaultItemIds } from "@/data/checklist";
import { getDestinationById } from "@/data/destinations";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { safePersistOptions } from "@/utils/persistStorage";

export const MAX_CUSTOM_ITEM_LENGTH = 60;

export interface CustomChecklistItem {
  id: string;
  label: string;
  sectionId: ChecklistSectionId;
}

export type ChecklistResetReason = "new_flight" | "manual";

/**
 * Completion marker for a checklist finished before any flight was saved
 * (`flightId` null). A real id would never collide with it.
 */
export const NO_FLIGHT_COMPLETION = "__no_flight__";

function completionKey(flightId: string | null) {
  return flightId ?? NO_FLIGHT_COMPLETION;
}

interface ChecklistState {
  addCustomItem: (sectionId: ChecklistSectionId, label: string) => void;
  checkedIds: string[];
  /**
   * Guards the "completed" achievement so a flight counts only once
   * (`NO_FLIGHT_COMPLETION` = completed before any flight existed).
   */
  completedFlightId: string | null;
  /** User-added items — survive resets, they are the traveller's personal list. */
  customItems: CustomChecklistItem[];
  /** Flight the current tick state belongs to (null = no flight yet). */
  flightId: string | null;
  removeCustomItem: (id: string) => void;
  resetForFlight: (
    flightId: string | null,
    reason: ChecklistResetReason
  ) => void;
  toggleItem: (id: string) => void;
}

type ProgressInput = Pick<ChecklistState, "checkedIds" | "customItems">;

/** Stable id for a destination-specific item (derived from the flight, not stored). */
export function destinationItemId(labelKey: string) {
  return `dest-${labelKey}`;
}

/**
 * `{ done, total }` over default + destination + custom items. `extraIds` comes
 * from the current flight's destination, so it changes with the flight.
 */
export function getChecklistProgress(
  state: ProgressInput,
  extraIds: string[] = []
) {
  const allIds = new Set([
    ...defaultItemIds,
    ...extraIds,
    ...state.customItems.map((item) => item.id),
  ]);
  const done = state.checkedIds.filter((id) => allIds.has(id)).length;
  return { done, total: allIds.size };
}

export function isChecklistComplete(
  state: ProgressInput,
  extraIds: string[] = []
) {
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
  const destination = destinationId
    ? getDestinationById(destinationId)
    : undefined;
  return (destination?.checklistExtras ?? []).map(destinationItemId);
}

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set, get) => ({
      addCustomItem: (sectionId, label) => {
        const trimmed = label.trim().slice(0, MAX_CUSTOM_ITEM_LENGTH);
        if (trimmed.length === 0) {
          return;
        }
        const id = `custom-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        set((state) => ({
          customItems: [
            ...state.customItems,
            { id, label: trimmed, sectionId },
          ],
        }));
        captureAnalyticsEvent("checklist_custom_added", { section: sectionId });
      },
      checkedIds: [],
      completedFlightId: null,
      customItems: [],
      flightId: null,

      removeCustomItem: (id) => {
        set((state) => ({
          checkedIds: state.checkedIds.filter((x) => x !== id),
          customItems: state.customItems.filter((item) => item.id !== id),
        }));
      },

      resetForFlight: (flightId, reason) => {
        const state = get();
        // A checklist completed (and counted) before any flight existed
        // stays counted once a flight adopts it.
        const adoptedCompletion =
          state.flightId === null &&
          state.completedFlightId === NO_FLIGHT_COMPLETION
            ? completionKey(flightId)
            : state.completedFlightId;
        if (reason === "manual") {
          // Clearing ticks must not re-arm the achievement for the same
          // flight (untick-all + retick would farm it), so keep the marker.
          set({
            checkedIds: [],
            completedFlightId: adoptedCompletion,
            flightId,
          });
        } else if (state.flightId === null) {
          // First flight after packing without one: the ticks were made for
          // this trip, so the flight adopts them instead of wiping them.
          set({ completedFlightId: adoptedCompletion, flightId });
        } else {
          set({ checkedIds: [], completedFlightId: null, flightId });
        }
        captureAnalyticsEvent("checklist_reset", { reason });
      },

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
          next.completedFlightId !== completionKey(next.flightId)
        ) {
          set({ completedFlightId: completionKey(next.flightId) });
          useAchievementStore.getState().incrementChecklistsCompleted();
          captureAnalyticsEvent("checklist_completed", {
            custom_count: next.customItems.length,
          });
        }
      },
    }),
    safePersistOptions(() => AsyncStorage, { name: "checklist" })
  )
);
