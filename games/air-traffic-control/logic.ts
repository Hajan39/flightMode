// Pure, React-free helpers for Air Traffic Control so the per-tap / per-tick
// decisions can be computed from current state outside any state updater
// (and unit-tested).

export type Runway = "A" | "B" | "C";

export interface Flight {
  callsign: string;
  expiresAt: number;
  fuel: number;
  id: number;
  maxFuel: number;
  runway: Runway;
}

/** Whole seconds of fuel left at `now` (never negative). */
export function fuelAt(flight: Flight, now: number): number {
  return Math.max(0, Math.ceil((flight.expiresAt - now) / 1000));
}

export type AssignOutcome =
  | { kind: "none"; flights: Flight[] }
  | { kind: "landed"; flights: Flight[]; points: number }
  | { kind: "wrong"; flights: Flight[] };

/**
 * Resolve a runway tap. The flight leaves the queue either way; a correct
 * runway scores, a wrong one costs a miss. `none` = the flight is already gone
 * (double tap / expired), the queue is returned unchanged.
 */
export function resolveAssignment(
  flights: Flight[],
  flightId: number,
  runway: Runway,
  level: number,
  now: number
): AssignOutcome {
  const flight = flights.find((f) => f.id === flightId);
  if (!flight) {
    return { flights, kind: "none" };
  }
  const remaining = flights.filter((f) => f.id !== flightId);
  if (flight.runway !== runway) {
    return { flights: remaining, kind: "wrong" };
  }
  return {
    flights: remaining,
    kind: "landed",
    points: 18 + fuelAt(flight, now) * 3 + level * 2,
  };
}

/** Advance fuel to `now`; flights out of fuel are removed and counted. */
export function tickFlights(
  flights: Flight[],
  now: number
): { changed: boolean; flights: Flight[]; lost: number } {
  let lost = 0;
  let changed = false;
  const next: Flight[] = [];
  for (const flight of flights) {
    const fuel = fuelAt(flight, now);
    if (fuel <= 0) {
      lost += 1;
      changed = true;
    } else if (fuel === flight.fuel) {
      next.push(flight);
    } else {
      changed = true;
      next.push({ ...flight, fuel });
    }
  }
  return { changed, flights: changed ? next : flights, lost };
}
