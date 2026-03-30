import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Flight } from '@/types/flight';

type FlightState = {
  flight: Flight | null;
  setFlight: (flight: Flight) => void;
  clearFlight: () => void;
};

export const useFlightStore = create<FlightState>()(
  persist(
    (set) => ({
      flight: null,
      setFlight: (flight) => set({ flight }),
      clearFlight: () => set({ flight: null }),
    }),
    {
      name: 'flight',
      storage: createJSONStorage(() => AsyncStorage),
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
