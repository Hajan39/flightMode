import { LEVELS } from "@/games/runway-jam/levels";
import {
  applyMove,
  buildGrid,
  GRID_SIZE,
  getFinalStars,
  getStars,
  isSolved,
  nextOptimalMove,
  PLANE_ID,
  reachablePositions,
  STAR_FACTOR,
  solveBFS,
  starThresholds,
  validateLevel,
} from "@/games/runway-jam/logic";

describe("runway jam levels", () => {
  test("there are exactly 30 levels (18 free + 12 Plus) with sequential ids", () => {
    expect(LEVELS).toHaveLength(30);
    expect(LEVELS.map((l) => l.id)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1)
    );
  });

  test.each(LEVELS.map((l) => [l.id, l] as const))(
    "level %i is valid",
    (_id, level) => {
      expect(validateLevel(level.pieces)).toBeNull();
    }
  );

  test.each(LEVELS.map((l) => [l.id, l] as const))(
    "level %i has unique piece ids",
    (_id, level) => {
      const ids = level.pieces.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  );

  test.each(LEVELS.map((l) => [l.id, l] as const))(
    "level %i is solvable and minMoves is the exact optimum",
    (_id, level) => {
      const optimal = solveBFS(level.pieces);
      expect(typeof optimal).toBe("number");
      expect(optimal).toBe(level.minMoves);
    }
  );

  test("tier bounds hold (1-4 easy <= 8, 9-12 hard >= 12, 13-18 expert >= 16)", () => {
    for (const level of LEVELS) {
      if (level.id <= 4) {
        expect(level.minMoves).toBeLessThanOrEqual(8);
      }
      if (level.id >= 9) {
        expect(level.minMoves).toBeGreaterThanOrEqual(12);
      }
      if (level.id >= 13) {
        expect(level.minMoves).toBeGreaterThanOrEqual(16);
      }
    }
  });

  test("expert tier (13-18) minMoves is non-decreasing", () => {
    const expert = LEVELS.filter((l) => l.id >= 13 && !l.plus);
    expect(expert).toHaveLength(6);
    for (let i = 1; i < expert.length; i += 1) {
      expect(expert[i].minMoves).toBeGreaterThanOrEqual(expert[i - 1].minMoves);
    }
  });

  test("Plus expert pack: 12 levels (19-30) after the free ones, harder than every free level, non-decreasing", () => {
    const free = LEVELS.filter((l) => !l.plus);
    const pack = LEVELS.filter((l) => l.plus);
    expect(free.map((l) => l.id)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1)
    );
    expect(pack.map((l) => l.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 19)
    );
    const hardestFree = Math.max(...free.map((l) => l.minMoves));
    for (let i = 0; i < pack.length; i += 1) {
      expect(pack[i].minMoves).toBeGreaterThan(hardestFree);
      if (i > 0) {
        expect(pack[i].minMoves).toBeGreaterThanOrEqual(pack[i - 1].minMoves);
      }
    }
  });

  test("every layout is distinct", () => {
    const key = (level: (typeof LEVELS)[number]) =>
      JSON.stringify(
        buildGrid(level.pieces).map((row) => row.map((id) => id >= 0))
      );
    expect(new Set(LEVELS.map(key)).size).toBe(LEVELS.length);
  });

  test.each(LEVELS.map((l) => [l.id, l] as const))(
    "level %i star thresholds follow the shared rule (3★ = optimum, 2★ = ceil(1.5×))",
    (_id, level) => {
      const { three, two } = starThresholds(level.minMoves);
      expect(three).toBe(level.minMoves);
      expect(two).toBe(Math.ceil(level.minMoves * STAR_FACTOR));
      expect(two).toBeGreaterThan(three);
      expect(getStars(level.minMoves, level.minMoves)).toBe(3);
      expect(getStars(level.minMoves + 1, level.minMoves)).toBe(2);
      expect(getStars(two, level.minMoves)).toBe(2);
      expect(getStars(two + 1, level.minMoves)).toBe(1);
      expect(getFinalStars(level.minMoves, level.minMoves, 1)).toBe(2);
    }
  );
});

describe("runway jam nextOptimalMove", () => {
  // Plus levels (28-46 moves) are too slow to replay hint-by-hint in CI; their
  // first hint must be legal and lower the proven optimum by exactly one.
  test.each(LEVELS.filter((l) => l.plus).map((l) => [l.id, l] as const))(
    "Plus level %i: the first hint is an optimal move",
    (_id, level) => {
      const move = nextOptimalMove(level.pieces);
      expect(move).not.toBeNull();
      if (move === null) {
        return;
      }
      const legal = reachablePositions(level.pieces, move.id).some(
        (p) => p.row === move.row && p.col === move.col
      );
      expect(legal).toBe(true);
      const after = applyMove(level.pieces, move.id, move.row, move.col);
      expect(solveBFS(after)).toBe(level.minMoves - 1);
    }
  );

  test.each(LEVELS.filter((l) => !l.plus).map((l) => [l.id, l] as const))(
    "level %i is solved by repeated hints in exactly minMoves moves",
    (_id, level) => {
      let state = level.pieces.map((p) => ({ ...p }));
      let moves = 0;
      while (!isSolved(state)) {
        const move = nextOptimalMove(state);
        expect(move).not.toBeNull();
        if (move === null) {
          return;
        }
        state = applyMove(state, move.id, move.row, move.col);
        moves += 1;
        expect(moves).toBeLessThanOrEqual(level.minMoves);
      }
      expect(moves).toBe(level.minMoves);
    }
  );

  test("returns null on a solved board", () => {
    const solved = [
      { col: GRID_SIZE - 2, horiz: true, id: PLANE_ID, len: 2, row: 2 },
    ];
    expect(isSolved(solved)).toBe(true);
    expect(nextOptimalMove(solved)).toBeNull();
  });
});

describe("runway jam applyMove / isSolved", () => {
  // Plane at (2,0) with a single vertical blocker in front of the exit.
  const board = [
    { col: 0, horiz: true, id: PLANE_ID, len: 2, row: 2 },
    { col: 4, horiz: false, id: 1, len: 3, row: 0 },
  ];

  test("a fresh board is not solved", () => {
    expect(isSolved(board)).toBe(false);
  });

  test("applyMove returns a new array and leaves the input untouched", () => {
    const moved = applyMove(board, PLANE_ID, 2, 2);
    expect(moved).not.toBe(board);
    expect(board[0].col).toBe(0);
    expect(moved.find((p) => p.id === PLANE_ID)?.col).toBe(2);
  });

  test("plane reaching the right edge solves the board", () => {
    const cleared = applyMove(board, 1, 3, 4); // blocker slides down
    const done = applyMove(cleared, PLANE_ID, 2, GRID_SIZE - 2);
    expect(isSolved(done)).toBe(true);
  });

  test("reachablePositions respects blockers", () => {
    // Plane origin can slide right up to column 2 — its leading edge stops
    // at column 3 because the blocker occupies column 4.
    const cols = reachablePositions(board, PLANE_ID).map((p) => p.col);
    expect(cols.sort()).toEqual([1, 2]);
    expect(solveBFS(board)).toBe(2);
  });
});

describe("runway jam validateLevel", () => {
  test("rejects a missing plane", () => {
    expect(
      validateLevel([{ col: 0, horiz: true, id: 1, len: 2, row: 0 }])
    ).toBe("missing plane (id 0)");
  });

  test("rejects a plane off row 2 or vertical", () => {
    expect(
      validateLevel([{ col: 0, horiz: true, id: 0, len: 2, row: 1 }])
    ).toBe("plane must be horizontal, length 2, on row 2");
    expect(
      validateLevel([{ col: 0, horiz: false, id: 0, len: 2, row: 2 }])
    ).toBe("plane must be horizontal, length 2, on row 2");
  });

  test("rejects overlaps, out-of-bounds pieces and duplicate ids", () => {
    const plane = { col: 0, horiz: true, id: 0, len: 2, row: 2 };
    expect(
      validateLevel([plane, { col: 1, horiz: false, id: 1, len: 2, row: 2 }])
    ).toBe("pieces overlap at (2,1)");
    expect(
      validateLevel([plane, { col: 5, horiz: true, id: 1, len: 3, row: 4 }])
    ).toBe("piece 1 is out of bounds");
    expect(
      validateLevel([plane, { col: 0, horiz: true, id: 0, len: 2, row: 0 }])
    ).toBe("duplicate id 0");
  });
});
