/**
 * Pure logic for the kids-mode game variants (`games/<id>/kids.tsx`).
 * No timers, scores or losing — only what a 3–6-year-old needs. Every
 * random choice takes an injectable `rnd` so tests are reproducible.
 */

export type Rnd = () => number;

/** Friendly, instantly recognisable pictures (no text needed). */
export const KIDS_ANIMALS = [
  "🐶",
  "🐱",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐸",
  "🐵",
  "🦁",
  "🐷",
  "🐮",
  "🐤",
] as const;

export const KIDS_FRUIT = ["🍎", "🍌", "🍓", "🍇", "🍊", "🍉"] as const;

const KIDS_VEHICLES = ["✈️", "🚗", "🚂", "🚀", "⛵", "🚲"] as const;

/** Picture groups for "find the odd one": the odd tile is from another group. */
const ODD_GROUPS: readonly (readonly string[])[] = [
  KIDS_ANIMALS,
  KIDS_FRUIT,
  KIDS_VEHICLES,
];

const pick = <T>(items: readonly T[], rnd: Rnd): T =>
  items[Math.min(items.length - 1, Math.floor(rnd() * items.length))];

export function shuffleWith<T>(items: readonly T[], rnd: Rnd): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rnd() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------- memory */

export interface KidsMemoryLevel {
  columns: number;
  pairs: number;
}

/** Level 0: 2×3 (3 pairs), level 1+: 3×4 (6 pairs). */
export const KIDS_MEMORY_LEVELS: readonly KidsMemoryLevel[] = [
  { columns: 2, pairs: 3 },
  { columns: 3, pairs: 6 },
];

/** A mismatched pair stays visible this long before turning back. */
export const KIDS_MEMORY_FLIP_BACK_MS = 1200;

export interface KidsCard {
  face: string;
  id: number;
  matched: boolean;
}

export function createKidsDeck(pairs: number, rnd: Rnd): KidsCard[] {
  const faces = shuffleWith(KIDS_ANIMALS, rnd).slice(0, pairs);
  return shuffleWith([...faces, ...faces], rnd).map((face, id) => ({
    face,
    id,
    matched: false,
  }));
}

/* -------------------------------------------------------- odd one out */

/** A short set: 5 rounds, then the celebration. */
export const KIDS_ODD_ROUNDS = 5;

export interface KidsOddRound {
  columns: number;
  items: string[];
  oddIndex: number;
}

/** Rounds 0–2: 4 tiles (2×2); later: 6 tiles (2×3). */
export function makeKidsOddRound(round: number, rnd: Rnd): KidsOddRound {
  const count = round < 3 ? 4 : 6;
  const groupIndex = Math.floor(rnd() * ODD_GROUPS.length);
  const base = pick(ODD_GROUPS[groupIndex], rnd);
  const otherGroups = ODD_GROUPS.filter((_, i) => i !== groupIndex);
  const odd = pick(pick(otherGroups, rnd), rnd);
  const oddIndex = Math.floor(rnd() * count);
  const items = Array.from({ length: count }, (_, i) =>
    i === oddIndex ? odd : base
  );
  return { columns: 2, items, oddIndex };
}

/* ---------------------------------------------------------- simon says */

/** Pads (big animal buttons) — each has its own colour token. */
export const KIDS_SIMON_PADS = ["🐶", "🐱", "🐸", "🐤"] as const;
/** Sequence length that ends the game with the celebration. */
export const KIDS_SIMON_GOAL = 4;
/** Slow playback: each pad lights this long, with this gap. */
export const KIDS_SIMON_FLASH_MS = 800;
export const KIDS_SIMON_GAP_MS = 450;
/** Pause before (re)playing a sequence. */
export const KIDS_SIMON_LEAD_MS = 900;

export function extendSimonSequence(sequence: number[], rnd: Rnd): number[] {
  return [
    ...sequence,
    Math.floor(rnd() * KIDS_SIMON_PADS.length) % KIDS_SIMON_PADS.length,
  ];
}

/**
 * Which pad is lit `elapsed` ms into the playback of `sequence`
 * (null = none: lead-in, a gap, or playback over). `done` once finished.
 */
export function simonPlaybackAt(
  sequence: readonly number[],
  elapsed: number
): { done: boolean; lit: number | null } {
  const t = elapsed - KIDS_SIMON_LEAD_MS;
  if (t < 0) {
    return { done: false, lit: null };
  }
  const step = KIDS_SIMON_FLASH_MS + KIDS_SIMON_GAP_MS;
  const index = Math.floor(t / step);
  if (index >= sequence.length) {
    return { done: true, lit: null };
  }
  return {
    done: false,
    lit: t - index * step < KIDS_SIMON_FLASH_MS ? sequence[index] : null,
  };
}

/* ---------------------------------------------------------- whack mole */

export const KIDS_MOLE_HOLES = 6;
/** Moles to tap before the celebration. */
export const KIDS_MOLE_GOAL = 8;
/** A mole stays up this long (slow); it just hides again if missed. */
export const KIDS_MOLE_UP_MS = 2600;
/** Pause between moles. */
export const KIDS_MOLE_PAUSE_MS = 700;

/** Next hole, never the same one twice in a row. */
export function nextMoleHole(previous: number | null, rnd: Rnd): number {
  const options = Array.from({ length: KIDS_MOLE_HOLES }, (_, i) => i).filter(
    (i) => i !== previous
  );
  return pick(options, rnd);
}

/* ------------------------------------------------------- sliding puzzle */

export const KIDS_SLIDE_SIZE = 3;
const SLIDE_CELLS = KIDS_SLIDE_SIZE * KIDS_SLIDE_SIZE;
/** Random slides from the solved board: few, so it stays easy (and solvable). */
export const KIDS_SLIDE_SHUFFLE_MOVES = 12;

/** 1…8 in order, 0 = the empty slot (bottom right). */
export function solvedSlideBoard(): number[] {
  return Array.from({ length: SLIDE_CELLS }, (_, i) =>
    i === SLIDE_CELLS - 1 ? 0 : i + 1
  );
}

export function isSlideSolved(board: readonly number[]): boolean {
  return board.every((v, i) => v === (i === SLIDE_CELLS - 1 ? 0 : i + 1));
}

function slideNeighbors(index: number): number[] {
  const row = Math.floor(index / KIDS_SLIDE_SIZE);
  const col = index % KIDS_SLIDE_SIZE;
  const out: number[] = [];
  if (row > 0) {
    out.push(index - KIDS_SLIDE_SIZE);
  }
  if (row < KIDS_SLIDE_SIZE - 1) {
    out.push(index + KIDS_SLIDE_SIZE);
  }
  if (col > 0) {
    out.push(index - 1);
  }
  if (col < KIDS_SLIDE_SIZE - 1) {
    out.push(index + 1);
  }
  return out;
}

/** Slides the tile at `index` into the empty slot; null if not adjacent. */
export function slideTile(
  board: readonly number[],
  index: number
): number[] | null {
  const empty = board.indexOf(0);
  if (!slideNeighbors(empty).includes(index)) {
    return null;
  }
  const next = [...board];
  next[empty] = board[index];
  next[index] = 0;
  return next;
}

/**
 * Shuffled by legal slides from the solved board (so always solvable), never
 * undoing the previous slide and never left solved.
 */
export function shuffleSlideBoard(
  rnd: Rnd,
  moves = KIDS_SLIDE_SHUFFLE_MOVES
): number[] {
  let board = solvedSlideBoard();
  let previousEmpty = -1;
  for (let i = 0; i < moves || isSlideSolved(board); i += 1) {
    const empty = board.indexOf(0);
    const options = slideNeighbors(empty).filter((n) => n !== previousEmpty);
    const target = pick(options, rnd);
    board = slideTile(board, target) ?? board;
    previousEmpty = empty;
  }
  return board;
}

/* ---------------------------------------------------------- cargo catch */

export const KIDS_CATCH_LANES = 3;
/** Things to catch before the celebration. */
export const KIDS_CATCH_GOAL = 8;
/** Slow fall: top to bottom in this long. */
export const KIDS_CATCH_FALL_MS = 4500;
export const KIDS_CATCH_SPAWN_MS = 2000;
/** Fall progress (0…1) at which the basket catches. */
export const KIDS_CATCH_LINE = 0.82;
export const KIDS_CATCH_ITEMS = ["🎁", "🍎", "🧸", "🍓", "⭐", "🎈"] as const;

/** Fall progress of an item spawned at `spawnAt` (wall clock). */
export function catchFallProgress(spawnAt: number, now: number): number {
  return Math.max(0, (now - spawnAt) / KIDS_CATCH_FALL_MS);
}
