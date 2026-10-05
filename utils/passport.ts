import { getDestinationById } from "@/data/destinations";
import type { LoggedFlight } from "@/types/flight";

export type PassportStamp = {
	id: string;
	departureTime: number;
	duration: number;
	city: string | null;
	emoji: string;
};

export type PassportSummary = {
	flights: number;
	minutesInAir: number;
	cities: number;
	countries: number;
	/** Newest first; only flights that have already departed. */
	stamps: PassportStamp[];
};

/** Upsert by id so editing the active flight never double-counts it. */
export function upsertLoggedFlight(
	log: LoggedFlight[],
	flight: LoggedFlight,
): LoggedFlight[] {
	const entry: LoggedFlight = {
		id: flight.id,
		departureTime: flight.departureTime,
		duration: flight.duration,
		...(flight.destinationId ? { destinationId: flight.destinationId } : {}),
	};
	const index = log.findIndex((f) => f.id === flight.id);
	if (index === -1) return [...log, entry];
	const next = [...log];
	next[index] = entry;
	return next;
}

export function getPassportSummary(
	log: LoggedFlight[],
	nowMs: number,
): PassportSummary {
	const departed = log
		.filter((f) => f.departureTime <= nowMs)
		.sort((a, b) => b.departureTime - a.departureTime);

	const cities = new Set<string>();
	const countries = new Set<string>();
	let minutesInAir = 0;

	const stamps = departed.map((f) => {
		// An in-progress flight counts only the minutes flown so far.
		minutesInAir += Math.min(f.duration, Math.floor((nowMs - f.departureTime) / 60000));
		const destination = f.destinationId
			? getDestinationById(f.destinationId)
			: undefined;
		if (destination) {
			cities.add(destination.id);
			countries.add(destination.country);
		}
		return {
			id: f.id,
			departureTime: f.departureTime,
			duration: f.duration,
			city: destination?.city ?? null,
			emoji: destination?.emoji ?? "✈️",
		};
	});

	return {
		flights: departed.length,
		minutesInAir,
		cities: cities.size,
		countries: countries.size,
		stamps,
	};
}
