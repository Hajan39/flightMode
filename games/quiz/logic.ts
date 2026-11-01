import type { WorldQuestion } from "@/data/worldQuiz";
import type { QuizMode } from "@/store/useQuizStore";
import { shuffle } from "@/utils/shuffle";

/** A question as played: options already in display order. */
export interface RoundQuestion {
  /** Index of the correct option in `options` (after shuffling). */
  answerIndex: number;
  explanation?: string;
  /** Stable React key (world id or `aviation-<n>`). */
  key: string;
  options: string[];
  question: string;
}

/** A source question before option shuffling. */
export interface SourceQuestion {
  answerIndex: number;
  explanation?: string;
  key: string;
  options: string[];
  question: string;
}

export const QUESTION_COUNT = 15;
/** World share of a Mix round (the rest are aviation questions). */
export const MIX_WORLD_COUNT = 10;

/**
 * Shuffles the options (Fisher–Yates) and remaps the correct index, so the
 * option text at `answerIndex` is always the original correct option.
 */
export function shuffleOptions(
  q: SourceQuestion,
  random: () => number = Math.random
): RoundQuestion {
  const order = shuffle(
    q.options.map((_, i) => i),
    random
  );
  return {
    ...q,
    answerIndex: order.indexOf(q.answerIndex),
    options: order.map((i) => q.options[i]),
  };
}

/** Bundled + downloaded questions, first occurrence of an id wins. */
export function mergeWorldPool(
  ...sources: readonly (readonly WorldQuestion[])[]
): WorldQuestion[] {
  const seen = new Set<string>();
  const out: WorldQuestion[] = [];
  for (const source of sources) {
    for (const q of source) {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        out.push(q);
      }
    }
  }
  return out;
}

/**
 * Picks `count` questions, preferring ones not in `asked`. When fewer than
 * `count` fresh ones remain, all fresh ones are used, the rest is filled
 * from already-asked ones and the history restarts (a new cycle) with just
 * this round's ids. Returns the round and the next history (oldest first).
 */
export function pickWithoutRepeats<T extends { id: string }>(
  pool: readonly T[],
  asked: readonly string[],
  count: number,
  random: () => number = Math.random
): { asked: string[]; picked: T[] } {
  const askedSet = new Set(asked);
  const fresh = pool.filter((q) => !askedSet.has(q.id));
  if (fresh.length >= count) {
    const picked = shuffle(fresh, random).slice(0, count);
    return { asked: [...asked, ...picked.map((q) => q.id)], picked };
  }
  const old = pool.filter((q) => askedSet.has(q.id));
  const picked = [
    ...shuffle(fresh, random),
    ...shuffle(old, random).slice(0, count - fresh.length),
  ];
  return { asked: picked.map((q) => q.id), picked };
}

export function worldToSource(q: WorldQuestion): SourceQuestion {
  return {
    answerIndex: q.answer,
    explanation: q.explanation || undefined,
    key: q.id,
    options: q.options,
    question: q.question,
  };
}

/**
 * Builds a round for `mode`: World = world questions only, Aviation = the
 * classic aviation set, Mix = MIX_WORLD_COUNT world + the rest aviation.
 * Question order and option order are shuffled; `asked` is the updated
 * world-question history (unchanged for an Aviation round).
 */
export function buildRound(
  mode: QuizMode,
  world: readonly WorldQuestion[],
  aviation: readonly SourceQuestion[],
  asked: readonly string[],
  random: () => number = Math.random,
  count: number = QUESTION_COUNT
): { asked: string[]; questions: RoundQuestion[] } {
  let worldCount = 0;
  if (mode === "world") {
    worldCount = count;
  } else if (mode === "mix") {
    worldCount = Math.min(MIX_WORLD_COUNT, count);
  }
  worldCount = Math.min(worldCount, world.length);
  const pick =
    worldCount > 0
      ? pickWithoutRepeats(world, asked, worldCount, random)
      : { asked: [...asked], picked: [] };
  const aviationPicked = shuffle(aviation, random).slice(
    0,
    count - pick.picked.length
  );
  const sources = [...pick.picked.map(worldToSource), ...aviationPicked];
  const ordered = mode === "mix" ? shuffle(sources, random) : sources;
  return {
    asked: pick.asked,
    questions: ordered.map((q) => shuffleOptions(q, random)),
  };
}
