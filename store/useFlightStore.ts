import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Flight, LoggedFlight } from "@/types/flight";
import { upsertLoggedFlight } from "@/utils/passport";
import { getDeviceOffsetMinutes } from "@/utils/timezone";

/**
 * Stamp the home UTC offset on a saved flight: keep an explicit value, keep
 * the stored one when the same flight is edited without moving its departure,
 * otherwise capture the device offset now (at the departure instant, so the
 * home zone's DST rules apply).
 */
export function withHomeOffset(
  flight: Flight,
  previous: Flight | null
): Flight {
  if (typeof flight.homeOffsetMinutes === "number") {
    return flight;
  }
  if (
    previous?.id === flight.id &&
    previous.departureTime === flight.departureTime &&
    typeof previous.homeOffsetMinutes === "number"
  ) {
    return { ...flight, homeOffsetMinutes: previous.homeOffsetMinutes };
  }
  return {
    ...flight,
    homeOffsetMinutes: getDeviceOffsetMinutes(flight.departureTime),
  };
}

interface FlightState {
  clearFlight: () => void;
  flight: Flight | null;
  /** Flight Passport: every flight ever saved, survives clearFlight(). */
  log: LoggedFlight[];
  setFlight: (flight: Flight) => void;
}

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      clearFlight: () => set({ flight: null }),
      flight: null,
      log: [],
      setFlight: (flight) =>
        set((s) => ({
          flight: withHomeOffset(flight, s.flight),
          log: upsertLoggedFlight(s.log, flight),
        })),
    }),
    {
      // v0 → v1: seed the passport with the flight that is already saved.
      // `flight.homeOffsetMinutes` is an additive optional field: flights
      // persisted without it simply fall back to the device offset, so no
      // version bump is needed.
      migrate: (persisted, version) => {
        const state = persisted as Partial<FlightState>;
        if (version < 1) {
          return {
            ...state,
            log: state.flight ? upsertLoggedFlight([], state.flight) : [],
          } as FlightState;
        }
        return state as FlightState;
      },
      name: "flight",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

/** Derived: elapsed time in minutes since departure */
export function getElapsedMinutes(flight: Flight): number {
  const now = Date.now();
  const elapsed = (now - flight.departureTime) / 60_000;
  return Math.max(0, Math.min(elapsed, flight.duration));
}

/** Derived: remaining time in minutes */
export function getRemainingMinutes(flight: Flight): number {
  return Math.max(0, flight.duration - getElapsedMinutes(flight));
}

/** Derived: progress 0–1 */
export function getFlightProgress(flight: Flight): number {
  if (flight.duration <= 0) {
    return 0;
  }
  return Math.min(1, getElapsedMinutes(flight) / flight.duration);
}
