import { findDestinationIdByAirport } from "@/data/destinationAirports";
import type { FlightLookupData } from "@/utils/flightLookup";

/** Longest flight the edit-screen steppers allow: 24:00. */
const MAX_DURATION_MINUTES = 24 * 60;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Edit-form fields a lookup can fill (in the screen's own formats). */
export interface FlightFormFill {
  /** "HH:MM" in the device's time zone. */
  departureClock: string;
  /** "YYYY-MM-DD" in the device's time zone. */
  departureDate: string;
  /** Matched bundled destination, if the arrival airport is one of them. */
  destinationId?: string;
  /** Duration as the steppers store it ("7" / "05"); absent = unknown. */
  durationHours?: string;
  durationMinutes?: string;
  /** Airport codes for the confirmation line, e.g. PRG → CDG. */
  route: { from: string; to: string };
}

/**
 * Maps a lookup to form values. The departure is the scheduled UTC instant
 * shown in the device's local time — the edit screen (and the whole app)
 * stores departure as a device-local wall time.
 */
export function mapLookupToForm(
  flight: FlightLookupData
): FlightFormFill | null {
  const departureMs = Date.parse(flight.departure.scheduledUtc);
  if (Number.isNaN(departureMs)) {
    return null;
  }
  const local = new Date(departureMs);
  const fill: FlightFormFill = {
    departureClock: `${pad2(local.getHours())}:${pad2(local.getMinutes())}`,
    departureDate: `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`,
    route: {
      from: flight.departure.iata ?? flight.departure.icao ?? "?",
      to: flight.arrival.iata ?? flight.arrival.icao ?? "?",
    },
  };

  const duration = flight.durationMinutes;
  if (duration !== null && duration > 0) {
    const total = Math.min(MAX_DURATION_MINUTES, Math.round(duration));
    fill.durationHours = String(Math.floor(total / 60));
    fill.durationMinutes = pad2(total % 60);
  }

  const destinationId = findDestinationIdByAirport(flight.arrival.iata);
  if (destinationId) {
    fill.destinationId = destinationId;
  }
  return fill;
}

export type FlightFormField = "departure" | "duration" | "destination";

/**
 * Fields the user changed while the lookup was running are left alone; the
 * rest are applied. Pressing "Fill in" again clears `touched` and refills.
 */
export function fieldsToApply(
  fill: FlightFormFill,
  touched: ReadonlySet<FlightFormField>
): Partial<Omit<FlightFormFill, "route">> {
  const apply: Partial<Omit<FlightFormFill, "route">> = {};
  if (!touched.has("departure")) {
    apply.departureDate = fill.departureDate;
    apply.departureClock = fill.departureClock;
  }
  if (
    !touched.has("duration") &&
    fill.durationHours !== undefined &&
    fill.durationMinutes !== undefined
  ) {
    apply.durationHours = fill.durationHours;
    apply.durationMinutes = fill.durationMinutes;
  }
  if (!touched.has("destination") && fill.destinationId) {
    apply.destinationId = fill.destinationId;
  }
  return apply;
}
