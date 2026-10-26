import { allTiles, type ConnectorId, tileDecks } from "@/data/emojiStoryTiles";

/** Pure helpers for Turbulence Tales (emoji story chain). */

export const HAND_SIZE = 6;
export const ACTS = 3;
export const MAX_TILES_PER_TURN = 2;

export interface Contribution {
  act: number;
  author: number;
  connector: ConnectorId;
  tiles: string[];
}

type Rng = () => number;

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Six unique tiles drawn across decks (at least one from 4 different decks). */
export function drawHand(
  rng: Rng = Math.random,
  exclude: Set<string> = new Set()
): string[] {
  const deckIds = shuffle(
    Object.keys(tileDecks) as (keyof typeof tileDecks)[],
    rng
  );
  const hand: string[] = [];
  for (const id of deckIds) {
    const candidates = shuffle(tileDecks[id], rng).filter(
      (t) => !(exclude.has(t) || hand.includes(t))
    );
    if (candidates[0]) {
      hand.push(candidates[0]);
    }
    if (hand.length >= 4) {
      break;
    }
  }
  const rest = shuffle(allTiles, rng).filter(
    (t) => !(exclude.has(t) || hand.includes(t))
  );
  while (hand.length < HAND_SIZE && rest.length) {
    hand.push(rest.shift() as string);
  }
  return hand;
}

/** Turn order across acts: each act, every seat plays once in seat order. */
export function turnSequence(
  playerCount: number,
  acts: number = ACTS
): { act: number; author: number }[] {
  const seq: { act: number; author: number }[] = [];
  for (let act = 0; act < acts; act += 1) {
    for (let author = 0; author < playerCount; author += 1) {
      seq.push({ act, author });
    }
  }
  return seq;
}

/**
 * Votes: `votes[voter] = index into contributions of the act` (or null).
 * A vote for your own contribution is ignored. Returns points per author.
 */
export function tallyVotes(
  contributions: Contribution[],
  votes: (number | null)[],
  playerCount: number
): number[] {
  const points = new Array(playerCount).fill(0) as number[];
  votes.forEach((choice, voter) => {
    if (choice === null) {
      return;
    }
    const target = contributions[choice];
    if (!target || target.author === voter) {
      return;
    }
    points[target.author] += 1;
  });
  return points;
}

export type EmojiStoryMode = "votes" | "story";

export type EmojiStoryRecord =
  /** Story-only: counts as a finished tale (games played), but no votes. */
  | { kind: "story"; score: 0; won: false }
  /** Voting match: recorded through `recordMatch` with the vote totals. */
  | { kind: "match"; standings: { score: number }[] };

/**
 * What to persist when a tale ends. Story-only mode has no votes, so it must
 * never record a score (Crowd Favorite = 5 votes) nor a win (host streaks).
 */
export function emojiStoryRecord(
  mode: EmojiStoryMode,
  voteScores: number[]
): EmojiStoryRecord {
  if (mode === "story") {
    return { kind: "story", score: 0, won: false };
  }
  return { kind: "match", standings: voteScores.map((score) => ({ score })) };
}
