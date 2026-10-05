export type Flight = {
  id: string;
  flightNumber?: string;
  departureTime: number; // Unix timestamp (ms)
  duration: number; // Duration in minutes
  destinationId?: string; // optional link to a bundled destination (data/destinations.ts)
};

/** Flight Passport entry — deliberately without the flight number. */
export type LoggedFlight = Pick<Flight, 'id' | 'departureTime' | 'duration' | 'destinationId'>;
