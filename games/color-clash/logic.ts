import { shuffle } from "@/utils/shuffle";

/** How the player responded to one trial. */
export type Response = "tap" | "skip";

/**
 * Exactly half of the rounds are matches (word = ink colour), in random
 * order. With a fixed 50/50 split, "never tap" and "always tap" both net
 * exactly 0 under `responseDelta`, so only real reading scores.
 */
export function buildMatchDeck(
  rounds: number,
  random: () => number = Math.random
): boolean[] {
  const matches = Math.floor(rounds / 2);
  const deck = Array.from({ length: rounds }, (_, i) => i < matches);
  return shuffle(deck, random);
}

/**
 * +1 for a correct response (tap on a match, no tap on a mismatch),
 * −1 for a mistake (tap on a mismatch, missed match).
 */
export function responseDelta(isMatch: boolean, response: Response): number {
  const correct = isMatch === (response === "tap");
  return correct ? 1 : -1;
}

/** Recorded score: the running total, never below zero. */
export function clampScore(total: number): number {
  return Math.max(0, total);
}
