// ─── Word Search — pure grid logic ──────────────────────────────────────────
//
// This module is intentionally free of ALL React / React Native imports so it
// can be unit-tested in isolation. Randomness is only ever taken from an
// injected `rng` (never Math.random) so tests can pass a seeded generator.

/** A placed word and the flat grid indices its letters occupy, in reading order. */
export interface Placement {
  cells: number[];
  word: string;
}

/** A generated puzzle: a size×size grid of single uppercase letters. */
export interface Puzzle {
  grid: string[];
  placements: Placement[];
  size: number;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The 8 straight directions as [dRow, dCol] steps. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // →  horizontal forward
  [0, -1], // ←  horizontal reverse
  [1, 0], // ↓  vertical down
  [-1, 0], // ↑  vertical up
  [1, 1], // ↘  diagonal
  [1, -1], // ↙  diagonal
  [-1, 1], // ↗  diagonal
  [-1, -1], // ↖  diagonal
];

/** Returns -1, 0, or 1 for the sign of `n`. */
function sign(n: number): number {
  if (n > 0) {
    return 1;
  }
  if (n < 0) {
    return -1;
  }
  return 0;
}

/**
 * Returns the flat indices from `start` to `end` (inclusive) IF they lie on a
 * straight horizontal, vertical, or diagonal line of any length ≥ 1; otherwise
 * returns null. Deterministic and pure.
 */
export function lineBetween(
  start: number,
  end: number,
  size: number
): number[] | null {
  if (size <= 0) {
    return null;
  }
  const total = size * size;
  if (
    start < 0 ||
    end < 0 ||
    start >= total ||
    end >= total ||
    !Number.isInteger(start) ||
    !Number.isInteger(end)
  ) {
    return null;
  }

  const startRow = Math.floor(start / size);
  const startCol = start % size;
  const endRow = Math.floor(end / size);
  const endCol = end % size;

  if (start === end) {
    return [start];
  }

  const dRow = endRow - startRow;
  const dCol = endCol - startCol;

  const isHorizontal = dRow === 0;
  const isVertical = dCol === 0;
  const isDiagonal = Math.abs(dRow) === Math.abs(dCol);

  if (!(isHorizontal || isVertical || isDiagonal)) {
    return null;
  }

  const steps = Math.max(Math.abs(dRow), Math.abs(dCol));
  const stepRow = sign(dRow);
  const stepCol = sign(dCol);

  const cells: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const r = startRow + stepRow * i;
    const c = startCol + stepCol * i;
    cells.push(r * size + c);
  }
  return cells;
}

/** Concatenates the letters found at `cells` in the given grid. */
export function readCells(grid: string[], cells: number[]): string {
  let out = "";
  for (const cell of cells) {
    out += grid[cell] ?? "";
  }
  return out;
}

/** Integer in [0, n) drawn from the injected rng. */
function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

/**
 * Attempts to place `word` on `grid` (size×size). Tries random directions and
 * start cells; a cell may overlap an existing letter only if they are equal.
 * Returns the placement (mutating `grid`) on success, or null if it could not
 * be placed within the attempt budget.
 */
function tryPlaceWord(
  grid: string[],
  word: string,
  size: number,
  rng: () => number
): Placement | null {
  const len = word.length;
  if (len === 0 || len > size) {
    return null;
  }

  const MAX_ATTEMPTS = 200;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const [dRow, dCol] = DIRECTIONS[randInt(rng, DIRECTIONS.length)];
    const startRow = randInt(rng, size);
    const startCol = randInt(rng, size);

    const endRow = startRow + dRow * (len - 1);
    const endCol = startCol + dCol * (len - 1);
    if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
      continue;
    }

    // Verify every cell is empty or already holds the matching letter.
    const cells: number[] = [];
    let ok = true;
    for (let i = 0; i < len; i += 1) {
      const r = startRow + dRow * i;
      const c = startCol + dCol * i;
      const idx = r * size + c;
      const existing = grid[idx];
      if (existing !== "" && existing !== word[i]) {
        ok = false;
        break;
      }
      cells.push(idx);
    }
    if (!ok) {
      continue;
    }

    // Commit.
    for (let i = 0; i < len; i += 1) {
      grid[cells[i]] = word[i];
    }
    return { cells, word };
  }
  return null;
}

/**
 * Builds a Word Search puzzle. Each word (forced uppercase) is placed along an
 * H/V/D direction (forward or reverse) without conflicting overlaps; equal
 * letters may overlap. Empty cells are then filled with random uppercase
 * letters drawn from `rng`. Words that cannot be placed are skipped; the
 * returned puzzle is always valid and every placement is guaranteed readable
 * (`readCells(grid, placement.cells) === placement.word`).
 */
export function buildPuzzle(
  words: string[],
  size: number,
  rng: () => number
): Puzzle {
  const grid: string[] = new Array(size * size).fill("");
  const placements: Placement[] = [];

  for (const raw of words) {
    const word = raw.toUpperCase();
    const placement = tryPlaceWord(grid, word, size, rng);
    if (placement) {
      placements.push(placement);
    }
  }

  // Fill remaining empty cells with random letters. Accented letters used by
  // the words (Č, Ř, Ü…) join the filler so they don't give the words away.
  const accented = [...new Set(words.join("").toUpperCase())].filter(
    (c) => !LETTERS.includes(c)
  );
  const letters = [...LETTERS, ...accented];
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] === "") {
      grid[i] = letters[randInt(rng, letters.length)];
    }
  }

  return { grid, placements, size };
}

/** A puzzle whose leftover letters, read row by row, spell `secret`. */
export interface SecretPuzzle extends Puzzle {
  secret: string;
}

/**
 * Builds an osmisměrka: words from `pool` are placed until the empty cells
 * can be filled exactly with one of `secrets` (letters only, no spaces).
 * Returns null if no layout worked within the attempt budget.
 */
export function buildSecretPuzzle(
  pool: string[],
  size: number,
  secrets: string[],
  rng: () => number
): SecretPuzzle | null {
  const lengths = new Set(secrets.map((s) => [...s].length));
  const maxSecret = Math.max(...lengths);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const grid: string[] = new Array(size * size).fill("");
    const placements: Placement[] = [];
    const order = [...pool];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = randInt(rng, i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    let empty = size * size;
    for (const raw of order) {
      if (empty <= maxSecret && lengths.has(empty)) {
        break;
      }
      const placement = tryPlaceWord(grid, raw.toUpperCase(), size, rng);
      if (placement) {
        placements.push(placement);
        empty = grid.filter((c) => c === "").length;
      }
    }
    const fits = secrets.filter((s) => [...s].length === empty);
    if (fits.length === 0) {
      continue;
    }
    const secret = fits[randInt(rng, fits.length)];
    const letters = [...secret];
    let k = 0;
    for (let i = 0; i < grid.length; i += 1) {
      if (grid[i] === "") {
        grid[i] = letters[k];
        k += 1;
      }
    }
    return { grid, placements, secret, size };
  }
  return null;
}
