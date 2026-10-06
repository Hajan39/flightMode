export interface Flight {
  departureTime: number; // Unix timestamp (ms)
  destinationId?: string; // optional link to a bundled destination (data/destinations.ts)
  duration: number; // Duration in minutes
  flightNumber?: string;
  id: string;
}

/** Flight Passport entry — deliberately without the flight number. */
export type LoggedFlight = Pick<
  Flight,
  "id" | "departureTime" | "duration" | "destinationId"
>;
