// Pure, dependency-free Sudoku helpers — extracted from the component so they
// can be unit-tested without React Native.

export const getRow = (i: number): number => Math.floor(i / 9);
export const getCol = (i: number): number => i % 9;
export const getBox = (i: number): number =>
  Math.floor(getRow(i) / 3) * 3 + Math.floor(getCol(i) / 3);

/** Two distinct cells are peers if they share a row, column, or 3×3 box. */
export function isPeer(a: number, b: number): boolean {
  return (
    a !== b &&
    (getRow(a) === getRow(b) ||
      getCol(a) === getCol(b) ||
      getBox(a) === getBox(b))
  );
}

/** Indices of filled cells whose value disagrees with the known solution. */
export function computeErrors(
  board: number[],
  solution: number[]
): Set<number> {
  const errs = new Set<number>();
  board.forEach((v, i) => {
    if (v !== 0 && v !== solution[i]) {
      errs.add(i);
    }
  });
  return errs;
}

/** The board matches the solution in every cell. */
export function isSolved(board: number[], solution: number[]): boolean {
  return (
    board.length === solution.length && board.every((v, i) => v === solution[i])
  );
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Row/column order that keeps bands intact: shuffle bands, then rows inside each. */
function bandOrder(rand: () => number): number[] {
  return shuffled([0, 1, 2], rand).flatMap((band) =>
    shuffled([0, 1, 2], rand).map((r) => band * 3 + r)
  );
}

/**
 * A fresh-looking variant of a verified puzzle: relabel digits, permute rows
 * within bands / bands, columns within stacks / stacks, optionally transpose.
 * These symmetries keep the grid valid, the solution unique and the logical
 * difficulty identical — ~10^12 variants per bank puzzle, no solver needed.
 */
export function transformPuzzle<
  T extends { clues: number[]; solution: number[] },
>(puzzle: T, rand: () => number = Math.random): T {
  const digits = [0, ...shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand)];
  const rows = bandOrder(rand);
  const cols = bandOrder(rand);
  const transpose = rand() < 0.5;
  const map = (grid: number[]) =>
    Array.from({ length: 81 }, (_, i) => {
      let r = rows[Math.floor(i / 9)];
      let c = cols[i % 9];
      if (transpose) {
        [r, c] = [c, r];
      }
      return digits[grid[r * 9 + c]];
    });
  return {
    ...puzzle,
    clues: map(puzzle.clues),
    solution: map(puzzle.solution),
  };
}
