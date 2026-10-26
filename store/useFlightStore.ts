import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Flight, LoggedFlight } from "@/types/flight";
import { upsertLoggedFlight } from "@/utils/passport";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";
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

/**
 * Hydration fix-up for flights saved before `homeOffsetMinutes` existed: a
 * still-upcoming flight gets the device offset now — the phone is most likely
 * still in the home zone, while after departure it may already show the
 * destination zone (so past/in-flight ones keep the caller fallback).
 */
export function fillMissingHomeOffset(
  flight: Flight | null | undefined,
  now = Date.now()
): Flight | null | undefined {
  if (
    !flight ||
    typeof flight.homeOffsetMinutes === "number" ||
    typeof flight.departureTime !== "number" ||
    flight.departureTime <= now
  ) {
    return flight;
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
    safePersistOptions(() => AsyncStorage, {
      // `flight.homeOffsetMinutes` is an additive optional field (no version
      // bump): an upcoming flight persisted without it gets it filled in on
      // hydration (persisted by the post-hydration write).
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<FlightState>) };
        return {
          ...state,
          flight: fillMissingHomeOffset(state.flight) ?? null,
        };
      },
      // v0 → v1: seed the passport with the flight that is already saved.
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
      version: 1,
    })
  )
);
enablePersistRecovery(useFlightStore);

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
