export interface Flight {
  departureTime: number; // Unix timestamp (ms)
  destinationId?: string; // optional link to a bundled destination (data/destinations.ts)
  duration: number; // Duration in minutes
  flightNumber?: string;
  /**
   * Home (departure) UTC offset in minutes, east-positive, captured from the
   * device when the flight is saved. Keeps the jet-lag shift stable after the
   * phone switches to the destination zone. Missing on flights saved before
   * this field existed → callers fall back to the device offset.
   */
  homeOffsetMinutes?: number;
  id: string;
}

/** Flight Passport entry — deliberately without the flight number. */
export type LoggedFlight = Pick<
  Flight,
  "id" | "departureTime" | "duration" | "destinationId"
>;
