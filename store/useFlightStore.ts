import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Flight, LoggedFlight } from '@/types/flight';
import { upsertLoggedFlight } from '@/utils/passport';

type FlightState = {
  flight: Flight | null;
  /** Flight Passport: every flight ever saved, survives clearFlight(). */
  log: LoggedFlight[];
  setFlight: (flight: Flight) => void;
  clearFlight: () => void;
};

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      flight: null,
      log: [],
      setFlight: (flight) =>
        set((s) => ({ flight, log: upsertLoggedFlight(s.log, flight) })),
      clearFlight: () => set({ flight: null }),
    }),
    {
      name: 'flight',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
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
    },
  ),
);

/** Derived: elapsed time in minutes since departure */
export function getElapsedMinutes(flight: Flight): number {
  const now = Date.now();
  const elapsed = (now - flight.departureTime) / 60000;
  return Math.max(0, Math.min(elapsed, flight.duration));
}

/** Derived: remaining time in minutes */
export function getRemainingMinutes(flight: Flight): number {
  return Math.max(0, flight.duration - getElapsedMinutes(flight));
}

/** Derived: progress 0–1 */
export function getFlightProgress(flight: Flight): number {
  if (flight.duration <= 0) return 0;
  return Math.min(1, getElapsedMinutes(flight) / flight.duration);
}
