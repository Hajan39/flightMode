import { getDestinationById, getDestinationCity } from "@/data/destinations";
import type { Language } from "@/i18n/translations";
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
  nowMs: number,
  /** Language of the stamp city names (countries are counted by id-stable English name). */
  language: Language = "en"
): PassportSummary {
  const departed = log
    .filter((f) => f.departureTime <= nowMs)
    .sort((a, b) => b.departureTime - a.departureTime);

  const cities = new Set<string>();
  const countries = new Set<string>();
  let minutesInAir = 0;

  const stamps = departed.map((f) => {
    // An in-progress flight counts only the minutes flown so far; a corrupt
    // (non-finite / negative) duration counts as 0 instead of poisoning totals.
    const duration =
      Number.isFinite(f.duration) && f.duration > 0 ? f.duration : 0;
    const flown = Math.min(
      duration,
      Math.floor((nowMs - f.departureTime) / 60_000)
    );
    minutesInAir += Number.isFinite(flown) && flown > 0 ? flown : 0;
    const destination = f.destinationId
      ? getDestinationById(f.destinationId)
      : undefined;
    if (destination) {
      cities.add(destination.id);
      countries.add(destination.country);
    }
    return {
      city: destination ? getDestinationCity(destination, language) : null,
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
