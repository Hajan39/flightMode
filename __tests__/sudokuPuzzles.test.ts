import { PUZZLES } from "@/games/sudoku/puzzles";

function isValidGroup(values: number[]): boolean {
  if (values.length !== 9) {
    return false;
  }
  const seen = new Set(values);
  if (seen.size !== 9) {
    return false;
  }
  return values.every((v) => v >= 1 && v <= 9);
}

function row(grid: number[], r: number): number[] {
  return grid.slice(r * 9, r * 9 + 9);
}
function col(grid: number[], c: number): number[] {
  return Array.from({ length: 9 }, (_, r) => grid[r * 9 + c]);
}
function box(grid: number[], b: number): number[] {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const out: number[] = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      out.push(grid[(br + r) * 9 + (bc + c)]);
    }
  }
  return out;
}

describe("sudoku puzzle bank", () => {
  test("bank has 15 puzzles (5 easy, 5 medium, 5 hard)", () => {
    expect(PUZZLES.length).toBe(15);
    const byDiff = PUZZLES.reduce<Record<string, number>>((acc, p) => {
      acc[p.difficulty] = (acc[p.difficulty] ?? 0) + 1;
      return acc;
    }, {});
    expect(byDiff).toEqual({ easy: 5, hard: 5, medium: 5 });
  });

  test.each(PUZZLES.map((p, i) => [i, p.difficulty, p] as const))(
    "puzzle #%i (%s) has 81 cells, a valid solution, and clues that match it",
    (_i, _diff, puzzle) => {
      expect(puzzle.clues.length).toBe(81);
      expect(puzzle.solution.length).toBe(81);

      // Every row, column, and 3x3 box of the solution is a permutation of 1..9.
      for (let i = 0; i < 9; i += 1) {
        expect(isValidGroup(row(puzzle.solution, i))).toBe(true);
        expect(isValidGroup(col(puzzle.solution, i))).toBe(true);
        expect(isValidGroup(box(puzzle.solution, i))).toBe(true);
      }

      // Every non-zero clue matches the solution; clues are 0..9.
      for (let i = 0; i < 81; i += 1) {
        const clue = puzzle.clues[i];
        expect(clue).toBeGreaterThanOrEqual(0);
        expect(clue).toBeLessThanOrEqual(9);
        if (clue !== 0) {
          expect(clue).toBe(puzzle.solution[i]);
        }
      }
    }
  );
});

describe("sudoku transformPuzzle", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { transformPuzzle } = require("@/games/sudoku/logic");

  test.each(PUZZLES.map((p, i) => [i, p] as const))(
    "variant of puzzle #%i stays valid with the same clue count",
    (_i, puzzle) => {
      let seed = 7;
      const rand = () => {
        seed = (seed * 16_807) % 2_147_483_647;
        return seed / 2_147_483_647;
      };
      const v = transformPuzzle(puzzle, rand);
      for (let i = 0; i < 9; i += 1) {
        expect(isValidGroup(row(v.solution, i))).toBe(true);
        expect(isValidGroup(col(v.solution, i))).toBe(true);
        expect(isValidGroup(box(v.solution, i))).toBe(true);
      }
      for (let i = 0; i < 81; i += 1) {
        if (v.clues[i] !== 0) {
          expect(v.clues[i]).toBe(v.solution[i]);
        }
      }
      expect(v.clues.filter((c: number) => c !== 0).length).toBe(
        puzzle.clues.filter((c) => c !== 0).length
      );
      expect(v.difficulty).toBe(puzzle.difficulty);
      expect(v.solution).not.toEqual(puzzle.solution);
    }
  );
});

/** Number of solutions of a clue grid, stopping at `cap` (MRV backtracking). */
function countSolutions(clues: number[], cap = 2): number {
  const g = [...clues];
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  const boxOf = (i: number) =>
    Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  for (let i = 0; i < 81; i += 1) {
    if (g[i] !== 0) {
      const bit = 1 << g[i];
      rows[Math.floor(i / 9)] |= bit;
      cols[i % 9] |= bit;
      boxes[boxOf(i)] |= bit;
    }
  }
  let found = 0;
  const search = (): void => {
    if (found >= cap) {
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (g[i] !== 0) {
        continue;
      }
      const used = rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)];
      let mask = 0;
      let n = 0;
      for (let v = 1; v <= 9; v += 1) {
        if (!(used & (1 << v))) {
          mask |= 1 << v;
          n += 1;
        }
      }
      if (n === 0) {
        return;
      }
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n === 1) {
          break;
        }
      }
    }
    if (best === -1) {
      found += 1;
      return;
    }
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(best);
    for (let v = 1; v <= 9 && found < cap; v += 1) {
      const bit = 1 << v;
      if (!(bestMask & bit)) {
        continue;
      }
      g[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      search();
      g[best] = 0;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
    }
  };
  search();
  return found;
}

describe("sudoku puzzle uniqueness", () => {
  test("the counter detects a multi-solution grid", () => {
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
  });

  test.each(PUZZLES.map((p, i) => [i, p.difficulty, p] as const))(
    "puzzle #%i (%s) has exactly one solution",
    (_i, _diff, puzzle) => {
      expect(countSolutions(puzzle.clues)).toBe(1);
    }
  );

  test.each(PUZZLES.map((p, i) => [i, p] as const))(
    "transformed variants of puzzle #%i stay uniquely solvable",
    (i, puzzle) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { transformPuzzle } = require("@/games/sudoku/logic");
      let seed = 11 + i;
      const rand = () => {
        seed = (seed * 16_807) % 2_147_483_647;
        return seed / 2_147_483_647;
      };
      for (let k = 0; k < 3; k += 1) {
        const v = transformPuzzle(puzzle, rand);
        expect(countSolutions(v.clues)).toBe(1);
      }
    }
  );
});
