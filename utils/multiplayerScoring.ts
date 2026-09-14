import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

/**
 * Scoring convention for pass-and-play / shared-screen games.
 *
 * `updateProgress(gameId, score, { won })` is recorded ONCE per match from the
 * host's (seat 0, the device owner's) perspective:
 *   - `score` = the host's match score,
 *   - `won`   = the host is the sole winner (a draw counts as not-won).
 *
 * This keeps `highScore` ("my best match"), `currentStreak/bestStreak`
 * ("my undefeated run") and `timesPlayed` ("matches hosted") truthful, so the
 * shared GameResult stats and profile numbers mean the same thing for solo and
 * multiplayer games.
 */

export type Standing = {
	score: number;
	/** Secondary sort key (e.g. total pips) used only to break score ties. */
	tiebreak?: number;
};

export type RankedStanding<T extends Standing> = T & {
	/** Seat index the standing belongs to. */
	index: number;
	/** 1-based rank; tied players share a rank. */
	rank: number;
};

/** Sort standings best-first; equal (score, tiebreak) pairs share a rank. */
export function rankStandings<T extends Standing>(
	standings: T[],
): RankedStanding<T>[] {
	const indexed = standings.map((s, index) => ({ ...s, index }));
	indexed.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const ta = a.tiebreak ?? 0;
		const tb = b.tiebreak ?? 0;
		if (tb !== ta) return tb - ta;
		return a.index - b.index;
	});
	let rank = 0;
	let prev: { score: number; tiebreak: number } | null = null;
	return indexed.map((s, position) => {
		const key = { score: s.score, tiebreak: s.tiebreak ?? 0 };
		if (!prev || prev.score !== key.score || prev.tiebreak !== key.tiebreak) {
			rank = position + 1;
			prev = key;
		}
		return { ...s, rank };
	});
}

/** Seat index of the single best player, or null when the top spot is shared. */
export function getSoleWinnerIndex(standings: Standing[]): number | null {
	if (standings.length === 0) return null;
	const ranked = rankStandings(standings);
	const leaders = ranked.filter((s) => s.rank === 1);
	return leaders.length === 1 ? leaders[0].index : null;
}

export type RecordMatchOptions = {
	/** Seat that represents the device owner. Default 0. */
	hostIndex?: number;
	/** Extra points added to the recorded score when the host wins. */
	bonusIfWon?: number;
};

/** Persist one finished match using the host convention above. */
export function recordMatch(
	gameId: string,
	standings: Standing[],
	opts: RecordMatchOptions = {},
): GameProgressUpdate {
	const hostIndex = opts.hostIndex ?? 0;
	const winner = getSoleWinnerIndex(standings);
	const won = winner === hostIndex;
	const hostScore = Math.max(0, Math.round(standings[hostIndex]?.score ?? 0));
	const score = hostScore + (won ? (opts.bonusIfWon ?? 0) : 0);
	return useGameStore.getState().updateProgress(gameId, score, { won });
}

/** Every game recorded through `recordMatch` — used by cross-game achievements. */
export const MULTIPLAYER_GAME_IDS = [
	"duel-tictactoe",
	"duel-dice",
	"duel-connect4",
	"duel-emoji-find",
	"duel-hangman",
	"cross-air-radar",
	"cross-code-breaker",
	"cross-liars-dice",
	"split-duel",
	"seat-neighbor",
	"emoji-story",
	"category-blitz",
	"tilt-balance",
] as const;
