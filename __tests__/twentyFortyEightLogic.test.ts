import {
  addRandomTile,
  applyMove,
  type Grid,
  isGameOver,
  playMove,
} from "@/games/twenty-forty-eight/logic";

/** rng that always returns the same value. */
const constant = (v: number) => () => v;

describe("2048 applyMove", () => {
  test("merges each pair once and scores the merged value", () => {
    const grid: Grid = [
      [2, 2, 2, 2],
      [4, 0, 4, 0],
      [0, 0, 0, 0],
      [8, 8, 16, 0],
    ];
    const out = applyMove(grid, "left");
    expect(out.moved).toBe(true);
    expect(out.grid).toEqual([
      [4, 4, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [16, 16, 0, 0],
    ]);
    expect(out.score).toBe(4 + 4 + 8 + 16);
  });

  test("a blocked direction does not move", () => {
    const grid: Grid = [
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(applyMove(grid, "left").moved).toBe(false);
  });
});

describe("2048 playMove (handleMove decision)", () => {
  test("a no-op move returns the same grid and spawns nothing", () => {
    const grid: Grid = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const out = playMove(grid, "left", constant(0));
    expect(out).toEqual({
      gained: 0,
      grid,
      moved: false,
      over: false,
      reached2048: false,
    });
    expect(out.grid).toBe(grid);
  });

  test("a move spawns exactly one tile and reports the points", () => {
    const grid: Grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const out = playMove(grid, "left", constant(0));
    expect(out.moved).toBe(true);
    expect(out.gained).toBe(4);
    const tiles = out.grid.flat().filter((v) => v !== 0);
    expect(tiles.sort((a, b) => a - b)).toEqual([2, 4]);
    // Input untouched.
    expect(grid[0]).toEqual([2, 2, 0, 0]);
  });

  test("reaching 2048 is reported", () => {
    const grid: Grid = [
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const out = playMove(grid, "left", constant(0));
    expect(out.reached2048).toBe(true);
    expect(out.gained).toBe(2048);
  });

  test("a move that fills the last cell with no merges left is game over", () => {
    // After sliding right, only [0][0] is empty; rng 0.95 spawns a 4 there,
    // and no neighbours match.
    const grid: Grid = [
      [2, 4, 8, 0],
      [8, 16, 32, 64],
      [16, 32, 64, 128],
      [32, 64, 128, 256],
    ];
    const out = playMove(grid, "right", constant(0.95));
    expect(out.moved).toBe(true);
    expect(out.grid[0]).toEqual([4, 2, 4, 8]);
    expect(out.over).toBe(true);
    expect(isGameOver(out.grid)).toBe(true);
  });
});

describe("2048 addRandomTile", () => {
  test("full grid is returned unchanged", () => {
    const full: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(addRandomTile(full, constant(0))).toBe(full);
  });
});
