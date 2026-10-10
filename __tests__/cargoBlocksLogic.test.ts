import {
  anyFits,
  applyClears,
  BOARD_SIZE,
  type Board,
  canPlace,
  canPlayAny,
  clearedCells,
  dealTray,
  emptyBoard,
  findClears,
  idx,
  newGame,
  type Piece,
  place,
  playMove,
  SHAPES,
  type Shape,
  scoreMove,
} from "@/games/cargo-blocks/logic";

/** Deterministic mulberry32 rng. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const shape = (id: string): Shape => {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) {
    throw new Error(`missing shape ${id}`);
  }
  return s;
};
const piece = (id: string, color = 1): Piece => ({ color, shape: shape(id) });

/** Board with every cell filled except the given flat indices. */
function fullExcept(holes: number[]): Board {
  const b = new Array(BOARD_SIZE * BOARD_SIZE).fill(1);
  for (const h of holes) {
    b[h] = 0;
  }
  return b;
}

describe("cargo-blocks shapes", () => {
  test("ids are unique and orientations are deduped", () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SHAPES.filter((s) => s.id.startsWith("dot"))).toHaveLength(1);
    expect(SHAPES.filter((s) => s.id.startsWith("line5"))).toHaveLength(2);
    expect(SHAPES.filter((s) => s.id.startsWith("lSmall"))).toHaveLength(4);
    expect(SHAPES.filter((s) => s.id.startsWith("t-"))).toHaveLength(4);
  });

  test("every shape is normalised to its top-left and fits the board", () => {
    for (const s of SHAPES) {
      expect(Math.min(...s.cells.map(([r]) => r))).toBe(0);
      expect(Math.min(...s.cells.map(([, c]) => c))).toBe(0);
      expect(s.width).toBeLessThanOrEqual(5);
      expect(s.height).toBeLessThanOrEqual(5);
      expect(s.weight).toBeGreaterThan(0);
    }
  });
});

describe("cargo-blocks placement", () => {
  test("canPlace respects bounds and occupied cells", () => {
    const b = emptyBoard();
    expect(canPlace(b, shape("line3-0"), 0, 5)).toBe(true);
    expect(canPlace(b, shape("line3-0"), 0, 6)).toBe(false);
    expect(canPlace(b, shape("line3-0"), -1, 0)).toBe(false);
    b[idx(0, 1)] = 2;
    expect(canPlace(b, shape("line3-0"), 0, 0)).toBe(false);
  });

  test("place paints the piece color without mutating the input", () => {
    const b = emptyBoard();
    const next = place(b, piece("square2-0", 3), 2, 2);
    expect(b.every((v) => v === 0)).toBe(true);
    expect(next[idx(2, 2)]).toBe(3);
    expect(next[idx(3, 3)]).toBe(3);
    expect(next.filter((v) => v !== 0)).toHaveLength(4);
  });
});

describe("cargo-blocks clears", () => {
  test("finds full rows and columns and clears them simultaneously", () => {
    const b = emptyBoard();
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      b[idx(4, i)] = 1;
      b[idx(i, 2)] = 2;
    }
    const clears = findClears(b);
    expect(clears).toEqual({ cols: [2], rows: [4] });
    expect(clearedCells(clears)).toHaveLength(15); // crossing cell counted once
    expect(applyClears(b, clears).every((v) => v === 0)).toBe(true);
  });

  test("no clears on an incomplete board", () => {
    expect(findClears(fullExcept([idx(3, 3)]))).toEqual({
      cols: [0, 1, 2, 4, 5, 6, 7],
      rows: [0, 1, 2, 4, 5, 6, 7],
    });
    expect(findClears(emptyBoard())).toEqual({ cols: [], rows: [] });
  });
});

describe("cargo-blocks anyFits / canPlayAny", () => {
  test("detects a single hole", () => {
    const b = fullExcept([idx(7, 7)]);
    expect(anyFits(b, shape("dot-0"))).toBe(true);
    expect(anyFits(b, shape("line2-0"))).toBe(false);
    expect(canPlayAny(b, [null, piece("line2-0"), null])).toBe(false);
    expect(canPlayAny(b, [null, piece("dot-0"), null])).toBe(true);
  });
});

describe("cargo-blocks dealTray", () => {
  test("deals three pieces with valid colors", () => {
    const tray = dealTray(emptyBoard(), seeded(1));
    expect(tray).toHaveLength(3);
    for (const p of tray) {
      expect(p.color).toBeGreaterThanOrEqual(1);
      expect(p.color).toBeLessThanOrEqual(6);
    }
  });

  test("guarantees a fitting piece when only a single cell is free", () => {
    const b = fullExcept([idx(5, 5)]);
    for (let seed = 1; seed <= 50; seed += 1) {
      const tray = dealTray(b, seeded(seed));
      expect(tray.some((p) => anyFits(b, p.shape))).toBe(true);
    }
  });

  test("bigger pieces are rarer than small ones", () => {
    const rng = seeded(7);
    let small = 0;
    let big = 0;
    for (let i = 0; i < 3000; i += 1) {
      for (const p of dealTray(emptyBoard(), rng)) {
        if (p.shape.cells.length <= 3) {
          small += 1;
        }
        if (p.shape.id.startsWith("square3")) {
          big += 1;
        }
      }
    }
    expect(small).toBeGreaterThan(big * 5);
  });
});

describe("cargo-blocks scoring + playMove", () => {
  test("scoreMove: cells, combo and streak", () => {
    expect(scoreMove(4, 0, 0)).toBe(4);
    expect(scoreMove(3, 1, 1)).toBe(13);
    expect(scoreMove(3, 2, 1)).toBe(43); // 2 lines -> 10*2*2
    expect(scoreMove(1, 1, 3)).toBe(31); // +20 streak bonus
  });

  test("illegal move returns null", () => {
    const state = newGame(seeded(3));
    expect(playMove(state, 0, 9, 9, seeded(3))).toBeNull();
    expect(
      playMove({ ...state, tray: [null, null, null] }, 0, 0, 0, seeded(3))
    ).toBeNull();
  });

  test("completing a row clears it, scores and builds a streak", () => {
    const board = emptyBoard();
    for (let c = 0; c < 6; c += 1) {
      board[idx(7, c)] = 1;
    }
    const state = {
      board,
      score: 0,
      streak: 1,
      tray: [piece("line2-0"), piece("dot-0"), null],
    };
    const res = playMove(state, 0, 7, 6, seeded(1));
    expect(res).not.toBeNull();
    if (!res) {
      return;
    }
    expect(res.lines).toBe(1);
    expect(res.cleared).toHaveLength(8);
    expect(res.state.board.every((v) => v === 0)).toBe(true);
    expect(res.gained).toBe(2 + 10 + 10);
    expect(res.state.streak).toBe(2);
    expect(res.state.tray[0]).toBeNull();
    expect(res.over).toBe(false);
  });

  test("placing the last tray piece deals a new tray; no clear resets streak", () => {
    const state = {
      board: emptyBoard(),
      score: 5,
      streak: 2,
      tray: [null, piece("dot-0"), null],
    };
    const res = playMove(state, 1, 0, 0, seeded(2));
    expect(res?.state.tray.every((p) => p !== null)).toBe(true);
    expect(res?.state.streak).toBe(0);
    expect(res?.state.score).toBe(6);
  });

  test("game over when no tray piece fits", () => {
    // Two staggered diagonals of isolated holes: every row and column keeps a gap.
    const board = fullExcept(
      Array.from({ length: BOARD_SIZE }, (_, i) => [
        idx(i, i),
        idx(i, (i + 2) % BOARD_SIZE),
      ]).flat()
    );
    const state = {
      board,
      score: 0,
      streak: 0,
      tray: [piece("dot-0"), piece("line2-0"), null],
    };
    const res = playMove(state, 0, 0, 0, seeded(1));
    expect(res?.over).toBe(true);
  });
});
