/** Minimum number of rounds in a code-breaker match. */
export const MIN_ROUNDS = 3;

/**
 * Rounds for a match of `playerCount` players: the first guesser rotates
 * every round (an edge — they get the first look at the code), so the total
 * is the smallest multiple of the player count that is at least
 * `MIN_ROUNDS`. Everyone opens equally often: 2 players → 4, 3 → 3,
 * 4–6 → one round each.
 */
export function codeBreakerRounds(playerCount: number): number {
  const count = Math.max(1, Math.floor(playerCount));
  return count * Math.ceil(MIN_ROUNDS / count);
}

/** 0-based seat that guesses first in the 1-based `roundNumber`. */
export function firstGuesser(roundNumber: number, playerCount: number): number {
  return (roundNumber - 1) % Math.max(1, playerCount);
}
