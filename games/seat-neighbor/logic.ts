import { type SNQuestion, type SNQuestionKind } from "@/data/seatNeighborQuestions";

/** Pure round scheduling + scoring for Seat Neighbor. */

export const MIND_MELD_ROUNDS = 5;
export const WYR_ROUNDS = 3;
export const TOTAL_ROUNDS = MIND_MELD_ROUNDS + WYR_ROUNDS;

export type Round = {
	question: SNQuestion;
	/** Seat that guesses in a mind-meld round (ignored for wyr). */
	guesser: 0 | 1;
	/** Seat whose real answer is being predicted. */
	answerer: 0 | 1;
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

function take(bank: SNQuestion[], kind: SNQuestionKind, n: number, seen: Set<string>, rng: Rng) {
	const fresh = shuffle(bank.filter((q) => q.kind === kind && !seen.has(q.id)), rng);
	const picked = fresh.slice(0, n);
	if (picked.length < n) {
		// Bank exhausted for this session: allow repeats.
		const rest = shuffle(bank.filter((q) => q.kind === kind && !picked.includes(q)), rng);
		picked.push(...rest.slice(0, n - picked.length));
	}
	return picked;
}

/**
 * Builds 8 rounds: 5 mind-meld + 3 would-you-rather, interleaved so the
 * match never ends on three identical round types; the guesser alternates.
 */
export function buildRounds(bank: SNQuestion[], seen: Set<string> = new Set(), rng: Rng = Math.random): Round[] {
	const mm = take(bank, "mindMeld", MIND_MELD_ROUNDS, seen, rng);
	const wyr = take(bank, "wyr", WYR_ROUNDS, seen, rng);
	// Fixed interleave pattern keeps variety: MM MM WYR MM WYR MM MM WYR
	const pattern: SNQuestionKind[] = ["mindMeld", "mindMeld", "wyr", "mindMeld", "wyr", "mindMeld", "mindMeld", "wyr"];
	const rounds: Round[] = [];
	let guesser: 0 | 1 = 0;
	for (const kind of pattern) {
		const question = kind === "mindMeld" ? mm.shift() : wyr.shift();
		if (!question) continue;
		const answerer: 0 | 1 = guesser === 0 ? 1 : 0;
		rounds.push({ question, guesser, answerer });
		if (kind === "mindMeld") guesser = answerer;
	}
	return rounds;
}

export type SyncTierKey =
	| "snTierStrangers"
	| "snTierSeatmates"
	| "snTierTravelBuddies"
	| "snTierSoulmates";

export function getSyncTier(sync: number): SyncTierKey {
	if (sync <= 2) return "snTierStrangers";
	if (sync <= 4) return "snTierSeatmates";
	if (sync <= 6) return "snTierTravelBuddies";
	return "snTierSoulmates";
}

/** A match is "won" (streak-worthy) when the pair syncs on 5+ of 8 rounds. */
export const SYNC_WIN_THRESHOLD = 5;
