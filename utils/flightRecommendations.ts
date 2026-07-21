import { gameRegistry, type GameDefinition } from "@/data/games";
import type { GameCategory } from "@/types/game";

/** Time buckets (minutes remaining) that decide which games to recommend. */
export const SHORT_FLIGHT_MAX = 15;
export const MEDIUM_FLIGHT_MAX = 90;

/**
 * Recommend solo games sized to the time left in the flight:
 * short hop → quick games (≤3 min), medium → mid-length (3–7 min),
 * long haul → deep/hard games. Within a bucket, games in the user's preferred
 * categories are surfaced first. Pure + dependency-light so it can be tested.
 */
export function pickFlightGames(
	remainingMin: number,
	preferred: GameCategory[],
	registry: GameDefinition[] = gameRegistry,
	limit = 4,
): GameDefinition[] {
	const solo = registry.filter((g) => !g.isPlayTogether);
	let pool: GameDefinition[];
	if (remainingMin <= SHORT_FLIGHT_MAX) {
		pool = solo.filter((g) => g.estimatedTime <= 3);
	} else if (remainingMin <= MEDIUM_FLIGHT_MAX) {
		pool = solo.filter((g) => g.estimatedTime > 3 && g.estimatedTime < 7);
	} else {
		pool = solo.filter((g) => g.estimatedTime >= 7 || g.difficulty === "hard");
	}
	if (preferred.length > 0) {
		pool = [...pool].sort(
			(a, b) =>
				Number(preferred.includes(b.category)) -
				Number(preferred.includes(a.category)),
		);
	}
	return pool.slice(0, limit);
}
