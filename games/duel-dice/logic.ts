import type { Standing } from "@/utils/multiplayerScoring";

export const ROUNDS = 10;
const DIE_FACES = 6;

/**
 * Highest pip total one player can reach in a match. The composite score
 * below uses a base strictly greater than this so round wins ALWAYS dominate
 * and total pips only break ties in wins.
 */
const SCORE_BASE = ROUNDS * DIE_FACES + 1;

/**
 * Match standing for one seat: ranked by round wins, ties in wins broken by
 * total pips. Encoded as a single lexicographic score (wins * 61 + total)
 * so `recordMatch` stores a meaningful, monotonic high score.
 */
export function diceStanding(wins: number, total: number): Standing {
  return { score: wins * SCORE_BASE + total };
}

export function diceStandings(
  wins: readonly number[],
  totals: readonly number[]
): Standing[] {
  return wins.map((w, i) => diceStanding(w, totals[i] ?? 0));
}
