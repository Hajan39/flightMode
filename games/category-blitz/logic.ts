import { categoryBlitzKeys, ROUNDS_PER_PLAYER } from "@/data/categoryBlitzCategories";
import type { TranslationKey } from "@/i18n/translations";

/** Pure turn scheduling for Category Blitz. */

export type Turn = {
	/** Seat that answers this turn. */
	player: number;
	/** 0-based round. */
	round: number;
	category: TranslationKey;
};

type Rng = () => number;

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * One turn per player per round, seat order inside a round. Categories never
 * repeat within a match (the bank is far larger than 6 players × 3 rounds).
 */
export function buildTurns(
	playerCount: number,
	rounds: number = ROUNDS_PER_PLAYER,
	bank: TranslationKey[] = categoryBlitzKeys,
	rng: Rng = Math.random,
): Turn[] {
	const needed = playerCount * rounds;
	let pool = shuffle(bank, rng);
	// Bank smaller than the match (never today) → reshuffle and allow repeats.
	while (pool.length < needed) pool = pool.concat(shuffle(bank, rng));

	const turns: Turn[] = [];
	for (let round = 0; round < rounds; round++) {
		for (let player = 0; player < playerCount; player++) {
			turns.push({ player, round, category: pool[turns.length] });
		}
	}
	return turns;
}

/** Totals per seat from the per-turn counts. */
export function tallyScores(
	turns: Turn[],
	counts: number[],
	playerCount: number,
): number[] {
	const totals = Array(playerCount).fill(0) as number[];
	turns.forEach((turn, index) => {
		totals[turn.player] += counts[index] ?? 0;
	});
	return totals;
}
