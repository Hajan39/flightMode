import type { Flight } from "@/types/flight";

/**
 * Where the traveller is in the journey. Home reorders its sections around
 * this: before departure it's about preparation, in the air about killing
 * time, and after landing about the destination.
 */
export type FlightPhase = "none" | "preflight" | "inflight" | "landed";

/** How long after arrival Home keeps showing the "you've landed" layout. */
export const LANDED_WINDOW_MS = 48 * 60 * 60 * 1000;

export function getFlightPhase(
  flight: Flight | null | undefined,
  nowMs: number
): FlightPhase {
  if (!flight) {
    return "none";
  }
  const arrivalMs = flight.departureTime + flight.duration * 60_000;
  if (nowMs < flight.departureTime) {
    return "preflight";
  }
  if (nowMs < arrivalMs) {
    return "inflight";
  }
  return nowMs - arrivalMs < LANDED_WINDOW_MS ? "landed" : "none";
}

/**
 * The flight Home should still show: `null` once the landed window has passed
 * (phase "none"), so an old trip stops sitting at 100 %. The stored flight
 * and its passport entry are left untouched.
 */
export function getCurrentFlight(
  flight: Flight | null | undefined,
  nowMs: number
): Flight | null {
  if (!flight) {
    return null;
  }
  return getFlightPhase(flight, nowMs) === "none" ? null : flight;
}
