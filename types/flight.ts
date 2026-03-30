export type Flight = {
  id: string;
  flightNumber?: string;
  departureTime: number; // Unix timestamp (ms)
  duration: number; // Duration in minutes
};
