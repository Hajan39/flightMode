import {
  applyMove,
  computeErrors,
  formatTime,
  getBox,
  getCol,
  getRow,
  isPeer,
  isSolved,
  isValidCompleteGrid,
} from "@/games/sudoku/logic";
import { PUZZLES } from "@/games/sudoku/puzzles";

describe("sudoku cell coordinates", () => {
  test("getRow/getCol/getBox for known indices", () => {
    expect([getRow(0), getCol(0), getBox(0)]).toEqual([0, 0, 0]);
    expect([getRow(80), getCol(80), getBox(80)]).toEqual([8, 8, 8]);
    expect([getRow(40), getCol(40), getBox(40)]).toEqual([4, 4, 4]);
    expect([getRow(20), getCol(20), getBox(20)]).toEqual([2, 2, 0]);
  });
});

describe("sudoku isPeer", () => {
  test("same row / col / box are peers", () => {
    expect(isPeer(0, 1)).toBe(true); // same row
    expect(isPeer(0, 9)).toBe(true); // same column
    expect(isPeer(0, 10)).toBe(true); // same 3x3 box
  });
  test("a cell is not its own peer", () => {
    expect(isPeer(0, 0)).toBe(false);
  });
  test("unrelated cells are not peers", () => {
    expect(isPeer(0, 80)).toBe(false);
  });
});

describe("sudoku computeErrors", () => {
  const { solution } = PUZZLES[0];

  test("no errors when the board matches the solution", () => {
    expect(computeErrors(solution, solution).size).toBe(0);
  });
  test("empty (0) cells are never errors", () => {
    const board = solution.map((_, i) => (i < 10 ? 0 : solution[i]));
    expect(computeErrors(board, solution).size).toBe(0);
  });
  test("a filled cell that disagrees with the solution is flagged", () => {
    const board = [...solution];
    const wrong = board[5] === 1 ? 2 : 1;
    board[5] = wrong;
    const errs = computeErrors(board, solution);
    expect(errs.has(5)).toBe(true);
    expect(errs.size).toBe(1);
  });
});

describe("sudoku isSolved", () => {
  const { solution } = PUZZLES[0];
  test("true when identical", () => {
    expect(isSolved([...solution], solution)).toBe(true);
  });
  test("false when one cell differs or a cell is empty", () => {
    const almost = [...solution];
    almost[0] = 0;
    expect(isSolved(almost, solution)).toBe(false);
  });
});

describe("sudoku applyMove (handleNumberInput decision)", () => {
  const { solution } = PUZZLES[0];

  test("placing the last correct digit wins", () => {
    const board = [...solution];
    board[7] = 0;
    const move = applyMove(board, solution, 7, solution[7]);
    expect(move.won).toBe(true);
    expect(move.isError).toBe(false);
    expect(move.errors.size).toBe(0);
    expect(move.board[7]).toBe(solution[7]);
  });

  test("a wrong digit is an error, keeps other error marks, and never wins", () => {
    const board = [...solution];
    board[3] = solution[3] === 1 ? 2 : 1; // existing wrong entry
    board[7] = 0;
    const wrong = solution[7] === 9 ? 8 : 9;
    const move = applyMove(board, solution, 7, wrong);
    expect(move.isError).toBe(true);
    expect(move.won).toBe(false);
    expect([...move.errors].sort((a, b) => a - b)).toEqual([3, 7]);
  });

  test("erasing (0) clears that cell's error and does not mutate input", () => {
    const board = [...solution];
    board[7] = solution[7] === 9 ? 8 : 9;
    const snapshot = [...board];
    const move = applyMove(board, solution, 7, 0);
    expect(move.errors.size).toBe(0);
    expect(move.won).toBe(false);
    expect(board).toEqual(snapshot);
  });
});

describe("sudoku formatTime", () => {
  test.each([
    [5, "0:05"],
    [65, "1:05"],
    [600, "10:00"],
    [0, "0:00"],
  ])("formats %i seconds as %s", (secs, expected) => {
    expect(formatTime(secs)).toBe(expected);
  });
});

describe("sudoku accepts any valid complete grid", () => {
  const { clues, solution } = PUZZLES[0];
  // Swapping digits 1↔2 everywhere keeps a valid grid but breaks the givens.
  const relabelled = solution.map((v) => {
    if (v === 1) {
      return 2;
    }
    if (v === 2) {
      return 1;
    }
    return v;
  });

  test("isValidCompleteGrid checks rows/cols/boxes and givens", () => {
    expect(isValidCompleteGrid(solution, clues)).toBe(true);
    expect(isValidCompleteGrid(relabelled)).toBe(true);
    expect(isValidCompleteGrid(relabelled, clues)).toBe(false);
    const dup = [...solution];
    dup[0] = dup[1];
    expect(isValidCompleteGrid(dup)).toBe(false);
    const holey = [...solution];
    holey[40] = 0;
    expect(isValidCompleteGrid(holey)).toBe(false);
  });

  test("a Latin square (rows + columns fine, boxes broken) is not a Sudoku", () => {
    const latin = Array.from(
      { length: 81 },
      (_, i) => ((Math.floor(i / 9) + (i % 9)) % 9) + 1
    );
    expect(isValidCompleteGrid(latin)).toBe(false);
  });

  test("non-integer / NaN cells and wrong-length boards are rejected", () => {
    const one = solution.indexOf(1);
    for (const bad of [1.5, Number.NaN]) {
      const grid = [...solution];
      grid[one] = bad;
      expect(isValidCompleteGrid(grid)).toBe(false);
    }
    expect(isValidCompleteGrid([...solution, 5])).toBe(false);
    expect(isValidCompleteGrid(solution.slice(0, 80))).toBe(false);
  });

  test("isSolved never accepts an empty or truncated board", () => {
    expect(isSolved([], solution)).toBe(false);
    expect(isSolved(solution.slice(0, 40), solution)).toBe(false);
  });

  test("a valid alternative fill that keeps the givens wins without errors", () => {
    // Clues with only the cells that agree between the two grids → the
    // relabelled grid is a legal alternative solution of these clues.
    const looseClues = solution.map((v, i) => (v === relabelled[i] ? v : 0));
    const board = [...relabelled];
    const idx = relabelled.findIndex((v, i) => v !== solution[i]);
    board[idx] = 0;
    const move = applyMove(board, solution, idx, relabelled[idx], looseClues);
    expect(move.won).toBe(true);
    expect(move.errors.size).toBe(0);
    expect(move.isError).toBe(false);
    expect(isSolved(relabelled, solution, looseClues)).toBe(true);
  });

  test("an alternative fill that overwrites givens never wins", () => {
    expect(isSolved(relabelled, solution, clues)).toBe(false);
  });

  test("an incomplete board keeps errors judged against the stored solution", () => {
    const board = [...relabelled];
    const idx = relabelled.findIndex((v, i) => v !== solution[i]);
    board[idx] = 0;
    const move = applyMove(board, solution, 80, board[80], clues);
    expect(move.won).toBe(false);
    expect(move.errors.size).toBeGreaterThan(0);
  });
});
