export type Flight = {
  id: string;
  flightNumber?: string;
  departureTime: number; // Unix timestamp (ms)
  duration: number; // Duration in minutes
  destinationId?: string; // optional link to a bundled destination (data/destinations.ts)
};
