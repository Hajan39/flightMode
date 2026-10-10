// ─── Sky Match — pure match-3 logic ─────────────────────────────────────────
//
// No React / React Native imports: everything here is unit-tested. Randomness
// comes only from an injected `rng`, tile ids from an injected id generator,
// so tests can replay a game exactly.

export const SIZE = 8;
export const KINDS = 6;

/**
 * Special tiles: a run of 4 makes a line clearer (`row` from a horizontal run,
 * `col` from a vertical one), an L/T shape makes a 3×3 `bomb`, and a run of 5
 * makes a `color` tile that clears every tile of the kind it's swapped with.
 */
export type Special = "none" | "row" | "col" | "bomb" | "color";

export interface Tile {
  id: number;
  /** 0..KINDS-1; -1 for a `color` tile, which matches nothing. */
  kind: number;
  special: Special;
}

export type Board = (Tile | null)[];

export type Rng = () => number;
export type IdGen = () => number;

export function createIdGen(start = 1): IdGen {
  let next = start;
  return () => {
    const id = next;
    next += 1;
    return id;
  };
}

export function index(row: number, col: number): number {
  return row * SIZE + col;
}

export function rowOf(i: number): number {
  return Math.floor(i / SIZE);
}

export function colOf(i: number): number {
  return i % SIZE;
}

export function areAdjacent(a: number, b: number): boolean {
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr + dc === 1;
}

function randomKind(rng: Rng): number {
  return Math.floor(rng() * KINDS);
}

function kindAt(board: Board, i: number): number {
  const tile = board[i];
  return tile ? tile.kind : -1;
}

/** Would placing `kind` at (row, col) complete a run with the two cells before it? */
function makesRun(board: Board, row: number, col: number, kind: number) {
  const left =
    col >= 2 &&
    kindAt(board, index(row, col - 1)) === kind &&
    kindAt(board, index(row, col - 2)) === kind;
  const up =
    row >= 2 &&
    kindAt(board, index(row - 1, col)) === kind &&
    kindAt(board, index(row - 2, col)) === kind;
  return left || up;
}

/** A full board with no ready-made runs and at least one legal move. */
export function createBoard(rng: Rng, nextId: IdGen): Board {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const board: Board = new Array(SIZE * SIZE).fill(null);
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        let kind = randomKind(rng);
        while (makesRun(board, row, col, kind)) {
          kind = (kind + 1) % KINDS;
        }
        board[index(row, col)] = { id: nextId(), kind, special: "none" };
      }
    }
    if (findHint(board)) {
      return board;
    }
  }
  throw new Error("sky-match: could not build a playable board");
}

interface Run {
  cells: number[];
  horizontal: boolean;
  kind: number;
}

function collectRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (const horizontal of [true, false]) {
    for (let line = 0; line < SIZE; line += 1) {
      let start = 0;
      for (let pos = 1; pos <= SIZE; pos += 1) {
        const at = (p: number) =>
          horizontal ? index(line, p) : index(p, line);
        const kind = kindAt(board, at(start));
        const same = pos < SIZE && kindAt(board, at(pos)) === kind;
        if (same) {
          continue;
        }
        if (kind >= 0 && pos - start >= 3) {
          const cells: number[] = [];
          for (let p = start; p < pos; p += 1) {
            cells.push(at(p));
          }
          runs.push({ cells, horizontal, kind });
        }
        start = pos;
      }
    }
  }
  return runs;
}

export interface MatchGroup {
  cells: number[];
  kind: number;
  runs: Run[];
}

/** Runs of 3+ merged into groups when they share a cell (L / T shapes). */
export function findGroups(board: Board): MatchGroup[] {
  const runs = collectRuns(board);
  const groups: MatchGroup[] = [];
  for (const run of runs) {
    const touching = groups.filter((g) =>
      run.cells.some((c) => g.cells.includes(c))
    );
    const merged: MatchGroup = {
      cells: [...run.cells],
      kind: run.kind,
      runs: [run],
    };
    for (const g of touching) {
      merged.runs.push(...g.runs);
      for (const c of g.cells) {
        if (!merged.cells.includes(c)) {
          merged.cells.push(c);
        }
      }
      groups.splice(groups.indexOf(g), 1);
    }
    groups.push(merged);
  }
  return groups;
}

/** Which special a group earns, and where it appears. */
export function specialFor(
  group: MatchGroup,
  focus: number[]
): { at: number; special: Special } | null {
  const longest = group.runs.reduce((a, b) =>
    b.cells.length > a.cells.length ? b : a
  );
  const hasH = group.runs.some((r) => r.horizontal);
  const hasV = group.runs.some((r) => !r.horizontal);
  let special: Special = "none";
  if (longest.cells.length >= 5) {
    special = "color";
  } else if (hasH && hasV) {
    special = "bomb";
  } else if (longest.cells.length === 4) {
    special = longest.horizontal ? "row" : "col";
  }
  if (special === "none") {
    return null;
  }
  const focused = group.cells.find((c) => focus.includes(c));
  if (focused !== undefined) {
    return { at: focused, special };
  }
  if (special === "bomb") {
    const h = group.runs.find((r) => r.horizontal);
    const v = group.runs.find((r) => !r.horizontal);
    const cross = h?.cells.find((c) => v?.cells.includes(c));
    if (cross !== undefined) {
      return { at: cross, special };
    }
  }
  return { at: longest.cells[Math.floor(longest.cells.length / 2)], special };
}

function mostCommonKind(board: Board): number {
  const counts = new Array(KINDS).fill(0);
  for (const tile of board) {
    if (tile && tile.kind >= 0) {
      counts[tile.kind] += 1;
    }
  }
  return counts.indexOf(Math.max(...counts));
}

/** Cells hit when a special tile at `i` goes off. */
function blastArea(board: Board, i: number, special: Special): number[] {
  const row = rowOf(i);
  const col = colOf(i);
  const cells: number[] = [];
  if (special === "row") {
    for (let c = 0; c < SIZE; c += 1) {
      cells.push(index(row, c));
    }
  } else if (special === "col") {
    for (let r = 0; r < SIZE; r += 1) {
      cells.push(index(r, col));
    }
  } else if (special === "bomb") {
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
          cells.push(index(r, c));
        }
      }
    }
  } else if (special === "color") {
    const kind = mostCommonKind(board);
    board.forEach((tile, j) => {
      if (tile && tile.kind === kind) {
        cells.push(j);
      }
    });
  }
  return cells;
}

/** Adds every cell reached by chained special tiles to `cleared`. */
function expandBlasts(board: Board, cleared: Set<number>, defused: number[]) {
  const queue = [...cleared];
  const fired = new Set<number>(defused);
  while (queue.length > 0) {
    const i = queue.shift() as number;
    const tile = board[i];
    if (!tile || tile.special === "none" || fired.has(i)) {
      continue;
    }
    fired.add(i);
    for (const j of blastArea(board, i, tile.special)) {
      if (!cleared.has(j)) {
        cleared.add(j);
        queue.push(j);
      }
    }
  }
}

/** Drops tiles down and fills the gaps from the top with new tiles. */
export function applyGravity(board: Board, rng: Rng, nextId: IdGen): Board {
  const next: Board = new Array(SIZE * SIZE).fill(null);
  for (let col = 0; col < SIZE; col += 1) {
    let write = SIZE - 1;
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const tile = board[index(row, col)];
      if (tile) {
        next[index(write, col)] = tile;
        write -= 1;
      }
    }
    for (let row = write; row >= 0; row -= 1) {
      next[index(row, col)] = {
        id: nextId(),
        kind: randomKind(rng),
        special: "none",
      };
    }
  }
  return next;
}

/** One cascade step: what vanished, what got created, the board after the fall. */
export interface Step {
  /** Board right after clearing (cleared cells null, new specials placed). */
  afterClear: Board;
  /** Board after gravity + refill. */
  afterFall: Board;
  cleared: number[];
  created: number[];
  points: number;
}

const SPECIAL_BONUS: Record<Special, number> = {
  bomb: 60,
  col: 40,
  color: 120,
  none: 0,
  row: 40,
};

function runCascade(
  start: Board,
  firstClear: Set<number> | null,
  focus: number[],
  rng: Rng,
  nextId: IdGen
): Step[] {
  const steps: Step[] = [];
  let board = start;
  let pendingClear = firstClear;
  let chain = 1;
  for (let guard = 0; guard < 100; guard += 1) {
    const groups = pendingClear ? [] : findGroups(board);
    if (!pendingClear && groups.length === 0) {
      break;
    }
    const cleared = new Set<number>(pendingClear ?? []);
    const createdTiles: { at: number; tile: Tile }[] = [];
    for (const group of groups) {
      for (const c of group.cells) {
        cleared.add(c);
      }
      const made = specialFor(group, chain === 1 ? focus : []);
      if (made) {
        createdTiles.push({
          at: made.at,
          tile: {
            id: nextId(),
            kind: made.special === "color" ? -1 : group.kind,
            special: made.special,
          },
        });
      }
    }
    // A swapped color tile has already done its job; don't fire it again.
    expandBlasts(board, cleared, chain === 1 && firstClear ? focus : []);
    const afterClear: Board = board.map((tile, i) =>
      cleared.has(i) ? null : tile
    );
    let bonus = 0;
    for (const { at, tile } of createdTiles) {
      afterClear[at] = tile;
      bonus += SPECIAL_BONUS[tile.special];
    }
    const afterFall = applyGravity(afterClear, rng, nextId);
    steps.push({
      afterClear,
      afterFall,
      cleared: [...cleared],
      created: createdTiles.map((c) => c.at),
      points: cleared.size * 10 * chain + bonus,
    });
    board = afterFall;
    pendingClear = null;
    chain += 1;
  }
  return steps;
}

function swapped(board: Board, a: number, b: number): Board {
  const next = [...board];
  next[a] = board[b];
  next[b] = board[a];
  return next;
}

/**
 * Plays a swap. Returns the cascade steps, or null when the swap is illegal
 * (not adjacent, or it makes no match and involves no `color` tile).
 */
export function playSwap(
  board: Board,
  a: number,
  b: number,
  rng: Rng,
  nextId: IdGen
): Step[] | null {
  if (!areAdjacent(a, b)) {
    return null;
  }
  const ta = board[a];
  const tb = board[b];
  if (!(ta && tb)) {
    return null;
  }
  const after = swapped(board, a, b);
  if (ta.special === "color" || tb.special === "color") {
    // The color tile wipes out the other tile's kind (two colors: everything).
    const target = ta.special === "color" ? tb : ta;
    const cleared = new Set<number>();
    after.forEach((tile, i) => {
      if (tile && (target.special === "color" || tile.kind === target.kind)) {
        cleared.add(i);
      }
    });
    cleared.add(a);
    cleared.add(b);
    return runCascade(after, cleared, [a, b], rng, nextId);
  }
  if (findGroups(after).length === 0) {
    return null;
  }
  return runCascade(after, null, [a, b], rng, nextId);
}

/** A legal swap if one exists (used for hints and the "no moves" check). */
export function findHint(board: Board): [number, number] | null {
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const neighbours: number[] = [];
    if (colOf(i) < SIZE - 1) {
      neighbours.push(i + 1);
    }
    if (rowOf(i) < SIZE - 1) {
      neighbours.push(i + SIZE);
    }
    for (const j of neighbours) {
      const ti = board[i];
      const tj = board[j];
      if (!(ti && tj)) {
        continue;
      }
      if (ti.special === "color" || tj.special === "color") {
        return [i, j];
      }
      if (findGroups(swapped(board, i, j)).length > 0) {
        return [i, j];
      }
    }
  }
  return null;
}

/** Rearranges the same tiles until there are no runs and a move exists. */
export function shuffleBoard(board: Board, rng: Rng, nextId: IdGen): Board {
  const tiles = board.filter((t): t is Tile => t !== null);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const order = [...tiles];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (findGroups(order).length === 0 && findHint(order)) {
      return order;
    }
  }
  return createBoard(rng, nextId);
}

// ─── Levels ─────────────────────────────────────────────────────────────────

export interface Level {
  id: number;
  moves: number;
  /** Score needed to pass (1★); 2★ / 3★ at 1.3× / 1.6×. */
  target: number;
}

export const LEVEL_COUNT = 30;

/** Levels get longer targets and slightly fewer moves as they go. */
export function getLevel(id: number): Level {
  const moves = Math.max(16, 24 - Math.floor((id - 1) / 4));
  const target = 900 + (id - 1) * 80;
  return { id, moves, target };
}

export function starsFor(level: Level, score: number): number {
  if (score >= Math.round(level.target * 1.6)) {
    return 3;
  }
  if (score >= Math.round(level.target * 1.3)) {
    return 2;
  }
  return score >= level.target ? 1 : 0;
}
