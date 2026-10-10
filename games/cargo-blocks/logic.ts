// Pure Cargo Blocks (1010!/Block-Blast style) helpers — no React, RNG injected
// so everything is unit-testable and deterministic under a seeded rng.

export const BOARD_SIZE = 8;
export const TRAY_SIZE = 3;
/** Number of luggage-tag colors; board cells hold 0 (empty) or 1..COLOR_COUNT. */
export const COLOR_COUNT = 6;

export const POINTS_PER_LINE = 10;
export const STREAK_BONUS = 10;

export type Rng = () => number;
/** Row-major flat board, length BOARD_SIZE², 0 = empty, otherwise a color. */
export type Board = number[];
export type Cell = readonly [row: number, col: number];

export interface Shape {
  cells: readonly Cell[];
  /** Footprint height in cells. */
  height: number;
  id: string;
  weight: number;
  /** Footprint width in cells. */
  width: number;
}

export interface Piece {
  color: number;
  shape: Shape;
}

export type Tray = (Piece | null)[];

export interface Clears {
  cols: number[];
  rows: number[];
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Build a shape from "#"/"." rows, normalised to its top-left corner. */
function fromRows(id: string, rows: string[], weight: number): Shape {
  const cells: Cell[] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === "#") {
        cells.push([r, c]);
      }
    }
  });
  return normalise(id, cells, weight);
}

function normalise(id: string, cells: Cell[], weight: number): Shape {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const shifted = cells
    .map(([r, c]) => [r - minR, c - minC] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    cells: shifted,
    height: Math.max(...shifted.map(([r]) => r)) + 1,
    id,
    weight,
    width: Math.max(...shifted.map(([, c]) => c)) + 1,
  };
}

const shapeKey = (s: Shape) => s.cells.map(([r, c]) => `${r},${c}`).join(";");

/** Every distinct 90° rotation of a base shape, each with the given weight. */
function rotations(id: string, rows: string[], weight: number): Shape[] {
  const out: Shape[] = [];
  let current = fromRows(id, rows, weight);
  for (let i = 0; i < 4; i += 1) {
    if (!out.some((s) => shapeKey(s) === shapeKey(current))) {
      out.push({ ...current, id: `${id}-${i}` });
    }
    // (r, c) -> (c, -r) rotates 90° clockwise.
    current = normalise(
      id,
      current.cells.map(([r, c]) => [c, -r] as const),
      weight
    );
  }
  return out;
}

/**
 * Weighted piece bag (weight per orientation). Small and medium pieces are
 * common; 5-long lines, the 3×3 crate and the big L are rare.
 */
export const SHAPES: readonly Shape[] = [
  ...rotations("dot", ["#"], 4),
  ...rotations("line2", ["##"], 4),
  ...rotations("line3", ["###"], 4),
  ...rotations("line4", ["####"], 3),
  ...rotations("line5", ["#####"], 1.5),
  ...rotations("square2", ["##", "##"], 5),
  ...rotations("square3", ["###", "###", "###"], 1.5),
  ...rotations("lSmall", ["#.", "##"], 2.5),
  ...rotations("lLarge", ["#..", "#..", "###"], 0.75),
  ...rotations("t", ["###", ".#."], 1),
  ...rotations("s", [".##", "##."], 1),
  ...rotations("z", ["##.", ".##"], 1),
];

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export const emptyBoard = (): Board =>
  new Array(BOARD_SIZE * BOARD_SIZE).fill(0);

export const idx = (row: number, col: number) => row * BOARD_SIZE + col;

/** Can the piece's top-left go at (row, col)? Out of bounds = false. */
export function canPlace(
  board: Board,
  shape: Shape,
  row: number,
  col: number
): boolean {
  if (
    row < 0 ||
    col < 0 ||
    row + shape.height > BOARD_SIZE ||
    col + shape.width > BOARD_SIZE
  ) {
    return false;
  }
  return shape.cells.every(([r, c]) => board[idx(row + r, col + c)] === 0);
}

/** New board with the piece placed. Caller must check canPlace first. */
export function place(
  board: Board,
  piece: Piece,
  row: number,
  col: number
): Board {
  const next = [...board];
  for (const [r, c] of piece.shape.cells) {
    next[idx(row + r, col + c)] = piece.color;
  }
  return next;
}

export function findClears(board: Board): Clears {
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < BOARD_SIZE; j += 1) {
      rowFull &&= board[idx(i, j)] !== 0;
      colFull &&= board[idx(j, i)] !== 0;
    }
    if (rowFull) {
      rows.push(i);
    }
    if (colFull) {
      cols.push(i);
    }
  }
  return { cols, rows };
}

/** Flat indices of every cell in the cleared rows and columns (deduped). */
export function clearedCells(clears: Clears): number[] {
  const set = new Set<number>();
  for (const r of clears.rows) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      set.add(idx(r, c));
    }
  }
  for (const c of clears.cols) {
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      set.add(idx(r, c));
    }
  }
  return [...set];
}

/** Rows and columns clear simultaneously (a crossing cell counts for both). */
export function applyClears(board: Board, clears: Clears): Board {
  const next = [...board];
  for (const i of clearedCells(clears)) {
    next[i] = 0;
  }
  return next;
}

export function anyFits(board: Board, shape: Shape): boolean {
  for (let r = 0; r <= BOARD_SIZE - shape.height; r += 1) {
    for (let c = 0; c <= BOARD_SIZE - shape.width; c += 1) {
      if (canPlace(board, shape, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export const canPlayAny = (board: Board, tray: Tray): boolean =>
  tray.some((p) => p !== null && anyFits(board, p.shape));

// ---------------------------------------------------------------------------
// Dealing
// ---------------------------------------------------------------------------

function pickWeighted(shapes: readonly Shape[], rng: Rng): Shape {
  const total = shapes.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * total;
  for (const s of shapes) {
    roll -= s.weight;
    if (roll < 0) {
      return s;
    }
  }
  return shapes.at(-1) as Shape;
}

const randomColor = (rng: Rng) => 1 + Math.floor(rng() * COLOR_COUNT);

export const randomPiece = (rng: Rng, shapes = SHAPES): Piece => ({
  color: randomColor(rng),
  shape: pickWeighted(shapes, rng),
});

/**
 * Deal a fresh tray. If none of the drawn pieces fits but some shape still
 * would, one slot is swapped for a (weighted) fitting shape — so a new tray
 * is never dead on arrival unless the board truly has no room.
 */
export function dealTray(board: Board, rng: Rng): Piece[] {
  const tray = Array.from({ length: TRAY_SIZE }, () => randomPiece(rng));
  if (tray.some((p) => anyFits(board, p.shape))) {
    return tray;
  }
  const fitting = SHAPES.filter((s) => anyFits(board, s));
  if (fitting.length > 0) {
    tray[Math.floor(rng() * TRAY_SIZE)] = randomPiece(rng, fitting);
  }
  return tray;
}

// ---------------------------------------------------------------------------
// Scoring + move resolution
// ---------------------------------------------------------------------------

/**
 * Points for one placement: 1 per cell placed, plus 10 per cleared line times
 * the number of lines cleared at once (combo), plus 10 per prior consecutive
 * clearing placement (streak ≥ 2).
 */
export function scoreMove(cells: number, lines: number, streak: number) {
  if (lines === 0) {
    return cells;
  }
  return (
    cells +
    POINTS_PER_LINE * lines * lines +
    STREAK_BONUS * Math.max(0, streak - 1)
  );
}

export interface GameState {
  board: Board;
  score: number;
  /** Consecutive placements that cleared at least one line. */
  streak: number;
  tray: Tray;
}

export interface MoveResult {
  cleared: number[];
  gained: number;
  lines: number;
  over: boolean;
  state: GameState;
}

export function newGame(rng: Rng): GameState {
  const board = emptyBoard();
  return { board, score: 0, streak: 0, tray: dealTray(board, rng) };
}

/** Place tray[slot] at (row, col). Returns null if the move is illegal. */
export function playMove(
  state: GameState,
  slot: number,
  row: number,
  col: number,
  rng: Rng
): MoveResult | null {
  const piece = state.tray[slot];
  if (!(piece && canPlace(state.board, piece.shape, row, col))) {
    return null;
  }
  const placed = place(state.board, piece, row, col);
  const clears = findClears(placed);
  const lines = clears.rows.length + clears.cols.length;
  const streak = lines > 0 ? state.streak + 1 : 0;
  const gained = scoreMove(piece.shape.cells.length, lines, streak);
  const board = applyClears(placed, clears);

  let tray: Tray = state.tray.map((p, i) => (i === slot ? null : p));
  if (tray.every((p) => p === null)) {
    tray = dealTray(board, rng);
  }

  return {
    cleared: clearedCells(clears),
    gained,
    lines,
    over: !canPlayAny(board, tray),
    state: { board, score: state.score + gained, streak, tray },
  };
}
