import {
  type Cell,
  COLS,
  checkWin,
  countFlagged,
  floodReveal,
  MINE_COUNT,
  makeEmptyBoard,
  neighbors,
  placeMines,
  ROWS,
  resolveTap,
  revealAllMines,
  toggleFlag,
} from "@/games/minesweeper/logic";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function countMines(board: Cell[][]): number {
  return board.flat().filter((c) => c.isMine).length;
}

describe("minesweeper board setup", () => {
  test("makeEmptyBoard is ROWS×COLS of blank cells", () => {
    const b = makeEmptyBoard();
    expect(b).toHaveLength(ROWS);
    expect(b.every((r) => r.length === COLS)).toBe(true);
    for (const cell of b.flat()) {
      expect(cell).toEqual({
        adjacentMines: 0,
        isFlagged: false,
        isMine: false,
        isRevealed: false,
      });
    }
  });

  test("neighbors are clamped to the board (corner has 3, centre has 8)", () => {
    expect(neighbors(0, 0)).toHaveLength(3);
    expect(neighbors(4, 4)).toHaveLength(8);
  });
});

describe("minesweeper placeMines", () => {
  const seeds = [1, 7, 42, 1234, 99_999];

  test.each(seeds)("seed %i: plants exactly MINE_COUNT mines", (seed) => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(seed));
    expect(countMines(board)).toBe(MINE_COUNT);
  });

  test.each(seeds)(
    "seed %i: the first-tap cell and its neighbours are safe",
    (seed) => {
      const [sr, sc] = [4, 4];
      const board = placeMines(makeEmptyBoard(), sr, sc, mulberry32(seed));
      expect(board[sr][sc].isMine).toBe(false);
      for (const [r, c] of neighbors(sr, sc)) {
        expect(board[r][c].isMine).toBe(false);
      }
    }
  );

  test.each(seeds)(
    "seed %i: adjacency counts match the planted mines",
    (seed) => {
      const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(seed));
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (board[r][c].isMine) {
            continue;
          }
          const actual = neighbors(r, c).filter(
            ([nr, nc]) => board[nr][nc].isMine
          ).length;
          expect(board[r][c].adjacentMines).toBe(actual);
        }
      }
    }
  );
});

describe("minesweeper floodReveal & win", () => {
  test("flooding an all-empty board reveals every cell → win", () => {
    const revealed = floodReveal(makeEmptyBoard(), 0, 0);
    expect(revealed.flat().every((c) => c.isRevealed)).toBe(true);
    expect(checkWin(revealed)).toBe(true);
  });

  test("flood never reveals a mine", () => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(42));
    const revealed = floodReveal(board, 4, 4);
    for (const cell of revealed.flat()) {
      if (cell.isMine) {
        expect(cell.isRevealed).toBe(false);
      }
    }
  });

  test("checkWin is false while a safe cell is still hidden", () => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(1));
    expect(checkWin(board)).toBe(false);
  });

  test("revealAllMines reveals every mine", () => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(7));
    const shown = revealAllMines(board);
    for (const cell of shown.flat()) {
      if (cell.isMine) {
        expect(cell.isRevealed).toBe(true);
      }
    }
  });
});

describe("minesweeper countFlagged", () => {
  test("counts flagged cells", () => {
    const board = makeEmptyBoard();
    board[0][0].isFlagged = true;
    board[3][5].isFlagged = true;
    expect(countFlagged(board)).toBe(2);
  });
});

describe("minesweeper resolveTap (handlePress decision)", () => {
  test("first tap plants mines exactly once and never loses", () => {
    const { board, result } = resolveTap(
      makeEmptyBoard(),
      4,
      4,
      false,
      mulberry32(7)
    );
    expect(["started", "win"]).toContain(result);
    expect(countMines(board)).toBe(MINE_COUNT);
    expect(board[4][4].isRevealed).toBe(true);
  });

  test("a second fast tap with mines already placed does not re-plant", () => {
    const first = resolveTap(makeEmptyBoard(), 0, 0, false, mulberry32(3));
    const minesBefore = first.board
      .flat()
      .map((c, i) => (c.isMine ? i : -1))
      .filter((i) => i >= 0);
    // Pick any still-covered safe cell for the second tap.
    const flat = first.board.flat();
    const idx = flat.findIndex((c) => !(c.isMine || c.isRevealed));
    const second = resolveTap(
      first.board,
      Math.floor(idx / COLS),
      idx % COLS,
      true,
      mulberry32(99)
    );
    const minesAfter = second.board
      .flat()
      .map((c, i) => (c.isMine ? i : -1))
      .filter((i) => i >= 0);
    expect(minesAfter).toEqual(minesBefore);
    expect(["safe", "win"]).toContain(second.result);
  });

  test("tapping a mine loses and reveals every mine", () => {
    const { board } = resolveTap(makeEmptyBoard(), 0, 0, false, mulberry32(5));
    const idx = board.flat().findIndex((c) => c.isMine);
    const out = resolveTap(board, Math.floor(idx / COLS), idx % COLS, true);
    expect(out.result).toBe("lose");
    expect(out.board.flat().every((c) => !c.isMine || c.isRevealed)).toBe(true);
  });

  test("flagged or revealed cells are ignored (same board back)", () => {
    const { board } = resolveTap(makeEmptyBoard(), 4, 4, false, mulberry32(1));
    expect(resolveTap(board, 4, 4, true)).toEqual({ board, result: "ignored" });
    const idx = board.flat().findIndex((cell) => !cell.isRevealed);
    const r = Math.floor(idx / COLS);
    const col = idx % COLS;
    const flagged = toggleFlag(board, r, col);
    expect(countFlagged(flagged)).toBe(1);
    expect(resolveTap(flagged, r, col, true).result).toBe("ignored");
    expect(countFlagged(toggleFlag(flagged, r, col))).toBe(0);
    expect(toggleFlag(board, 4, 4)).toBe(board);
  });

  test("revealing the last safe cell wins", () => {
    const { board } = resolveTap(makeEmptyBoard(), 4, 4, false, mulberry32(2));
    const flat = board.flat();
    const covered = flat
      .map((c, i) => (c.isMine || c.isRevealed ? -1 : i))
      .filter((i) => i >= 0);
    let current = board;
    let last = "started";
    for (const i of covered) {
      const out = resolveTap(current, Math.floor(i / COLS), i % COLS, true);
      current = out.board;
      if (out.result !== "ignored") {
        last = out.result;
      }
    }
    expect(last).toBe("win");
    expect(checkWin(current)).toBe(true);
  });
});
