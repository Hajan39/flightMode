import { useFlightStore } from "@/store/useFlightStore";
import { type FlightPhase, getFlightPhase } from "@/utils/flightPhase";

/**
 * Current journey phase for the stored flight. `nowMs` comes from the caller
 * (Home's 30 s tick) so the phase flips without an extra timer.
 */
export function useFlightPhase(nowMs: number): FlightPhase {
	const flight = useFlightStore((s) => s.flight);
	return getFlightPhase(flight, nowMs);
}

export type { FlightPhase };
