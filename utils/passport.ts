import { getDestinationById } from "@/data/destinations";
import type { LoggedFlight } from "@/types/flight";

export interface PassportStamp {
  city: string | null;
  departureTime: number;
  duration: number;
  emoji: string;
  id: string;
}

export interface PassportSummary {
  cities: number;
  countries: number;
  flights: number;
  minutesInAir: number;
  /** Newest first; only flights that have already departed. */
  stamps: PassportStamp[];
}

/** Upsert by id so editing the active flight never double-counts it. */
export function upsertLoggedFlight(
  log: LoggedFlight[],
  flight: LoggedFlight
): LoggedFlight[] {
  const entry: LoggedFlight = {
    departureTime: flight.departureTime,
    duration: flight.duration,
    id: flight.id,
    ...(flight.destinationId ? { destinationId: flight.destinationId } : {}),
  };
  const index = log.findIndex((f) => f.id === flight.id);
  if (index === -1) {
    return [...log, entry];
  }
  const next = [...log];
  next[index] = entry;
  return next;
}

export function getPassportSummary(
  log: LoggedFlight[],
  nowMs: number
): PassportSummary {
  const departed = log
    .filter((f) => f.departureTime <= nowMs)
    .sort((a, b) => b.departureTime - a.departureTime);

  const cities = new Set<string>();
  const countries = new Set<string>();
  let minutesInAir = 0;

  const stamps = departed.map((f) => {
    // An in-progress flight counts only the minutes flown so far.
    minutesInAir += Math.min(
      f.duration,
      Math.floor((nowMs - f.departureTime) / 60_000)
    );
    const destination = f.destinationId
      ? getDestinationById(f.destinationId)
      : undefined;
    if (destination) {
      cities.add(destination.id);
      countries.add(destination.country);
    }
    return {
      city: destination?.city ?? null,
      departureTime: f.departureTime,
      duration: f.duration,
      emoji: destination?.emoji ?? "✈️",
      id: f.id,
    };
  });

  return {
    cities: cities.size,
    countries: countries.size,
    flights: departed.length,
    minutesInAir,
    stamps,
  };
}
