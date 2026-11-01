/**
 * Kids maze — pure logic (no React, no imports), unit-tested in
 * `__tests__/kidsNewGames.test.ts` and reused by the e2e spec to walk the
 * solution. A maze is a perfect maze (every cell reachable, exactly one path
 * between two cells) carved by a seeded depth-first search, so the same seed
 * always gives the same maze and every maze is solvable.
 *
 * Cells are numbered row by row: `index = row * size + col`. The animal
 * starts top-left (0), the goal is bottom-right (`size * size - 1`).
 */

export interface KidsMaze {
  /** `downOpen[i]`: no wall between cell i and the cell below it. */
  downOpen: boolean[];
  /** `rightOpen[i]`: no wall between cell i and the cell right of it. */
  rightOpen: boolean[];
  seed: number;
  size: number;
}

/** Grid size per round: 4×4, 5×5, then 6×6 (three mazes, then 🎉). */
export const KIDS_MAZE_SIZES = [4, 5, 6] as const;
export const KIDS_MAZE_ROUNDS = KIDS_MAZE_SIZES.length;
/** A soft glow shows the next cell after this long without progress. */
export const KIDS_MAZE_HINT_MS = 6000;

/** Seeded PRNG (mulberry32): same seed → same maze. */
export function mazeRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const mazeStart = (_maze: KidsMaze) => 0;
export const mazeGoal = (maze: KidsMaze) => maze.size * maze.size - 1;

/** Grid neighbours of `cell` (walls ignored). */
function gridNeighbors(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const out: number[] = [];
  if (row > 0) {
    out.push(cell - size);
  }
  if (col < size - 1) {
    out.push(cell + 1);
  }
  if (row < size - 1) {
    out.push(cell + size);
  }
  if (col > 0) {
    out.push(cell - 1);
  }
  return out;
}

function openBetween(maze: KidsMaze, a: number, b: number, open: boolean) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo === 1) {
    maze.rightOpen[lo] = open;
  } else {
    maze.downOpen[lo] = open;
  }
}

/** True when a and b are grid neighbours with no wall between them. */
export function canMove(maze: KidsMaze, from: number, to: number): boolean {
  const { size } = maze;
  const cells = size * size;
  if (from < 0 || to < 0 || from >= cells || to >= cells) {
    return false;
  }
  if (!gridNeighbors(size, from).includes(to)) {
    return false;
  }
  const lo = Math.min(from, to);
  return Math.abs(from - to) === 1 ? maze.rightOpen[lo] : maze.downOpen[lo];
}

/** Open neighbours of `cell`. */
export function mazeExits(maze: KidsMaze, cell: number): number[] {
  return gridNeighbors(maze.size, cell).filter((n) => canMove(maze, cell, n));
}

/** Iterative randomized DFS ("recursive backtracker") from the start cell. */
export function generateMaze(size: number, seed: number): KidsMaze {
  const cells = size * size;
  const maze: KidsMaze = {
    downOpen: new Array<boolean>(cells).fill(false),
    rightOpen: new Array<boolean>(cells).fill(false),
    seed,
    size,
  };
  const rnd = mazeRandom(seed);
  const visited = new Array<boolean>(cells).fill(false);
  const stack = [0];
  visited[0] = true;
  while (stack.length > 0) {
    const cell = stack.at(-1) as number;
    const fresh = gridNeighbors(size, cell).filter((n) => !visited[n]);
    if (fresh.length === 0) {
      stack.pop();
      continue;
    }
    const next =
      fresh[Math.min(fresh.length - 1, Math.floor(rnd() * fresh.length))];
    openBetween(maze, cell, next, true);
    visited[next] = true;
    stack.push(next);
  }
  return maze;
}

/** Shortest open path from `from` to `to` (both included); null if none. */
export function solveMaze(
  maze: KidsMaze,
  from = 0,
  to = mazeGoal(maze)
): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  // for…of over an array also visits the cells pushed while iterating.
  for (const cell of queue) {
    if (cell === to) {
      const path: number[] = [];
      for (let c = to; c !== -1; c = prev.get(c) as number) {
        path.unshift(c);
      }
      return path;
    }
    for (const n of mazeExits(maze, cell)) {
      if (!prev.has(n)) {
        prev.set(n, cell);
        queue.push(n);
      }
    }
  }
  return null;
}

/** The cell to glow as a hint: next step on the way to the goal. */
export function nextHintCell(maze: KidsMaze, from: number): number | null {
  const path = solveMaze(maze, from);
  return path && path.length > 1 ? path[1] : null;
}

/**
 * Where the animal ends up when the finger is over `target`: it walks
 * straight toward a target in the same row or column, cell by cell, and
 * stops at the first wall. A target elsewhere (diagonal) is ignored.
 */
export function stepToward(
  maze: KidsMaze,
  from: number,
  target: number
): number {
  const { size } = maze;
  if (target === from || target < 0 || target >= size * size) {
    return from;
  }
  const sameRow = Math.floor(from / size) === Math.floor(target / size);
  const sameCol = from % size === target % size;
  if (!(sameRow || sameCol)) {
    return from;
  }
  const step = sameRow
    ? Math.sign(target - from)
    : Math.sign(target - from) * size;
  let at = from;
  while (at !== target && canMove(maze, at, at + step)) {
    at += step;
  }
  return at;
}

/** Cell under a point (board-relative px); -1 outside the board. */
export function cellAt(
  size: number,
  cellPx: number,
  x: number,
  y: number
): number {
  const col = Math.floor(x / cellPx);
  const row = Math.floor(y / cellPx);
  if (col < 0 || row < 0 || col >= size || row >= size) {
    return -1;
  }
  return row * size + col;
}
