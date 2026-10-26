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

/**
 * Mastermind feedback for `guess` against `secret` (same length): `bulls` =
 * right digit in the right place, `cows` = right digit in the wrong place
 * (multiset intersection of the non-bull positions, so repeated digits are
 * never counted twice).
 */
export function calcBullsCows(
  secret: readonly number[],
  guess: readonly number[]
): { bulls: number; cows: number } {
  let bulls = 0;
  const secretRest = new Map<number, number>();
  const guessRest = new Map<number, number>();
  const length = Math.min(secret.length, guess.length);
  for (let i = 0; i < length; i += 1) {
    if (secret[i] === guess[i]) {
      bulls += 1;
    } else {
      secretRest.set(secret[i], (secretRest.get(secret[i]) ?? 0) + 1);
      guessRest.set(guess[i], (guessRest.get(guess[i]) ?? 0) + 1);
    }
  }
  let cows = 0;
  for (const [digit, count] of secretRest) {
    cows += Math.min(count, guessRest.get(digit) ?? 0);
  }
  return { bulls, cows };
}
