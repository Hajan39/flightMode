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
    const mines = revealed.flat().filter((c) => c.isMine);
    // Guard against a vacuous pass on a mine-less board.
    expect(mines).toHaveLength(MINE_COUNT);
    expect(mines.filter((c) => c.isRevealed)).toEqual([]);
    // The safe opening (adjacency 0) actually opened more than one cell.
    expect(revealed.flat().filter((c) => c.isRevealed).length).toBeGreaterThan(
      1
    );
  });

  test("flood stops at numbered cells (reveals them, not past them)", () => {
    const board = makeEmptyBoard();
    // A wall of numbered cells on column 4 (hand-set adjacency).
    for (let r = 0; r < ROWS; r += 1) {
      board[r][4].adjacentMines = 1;
    }
    const revealed = floodReveal(board, 0, 0);
    for (let r = 0; r < ROWS; r += 1) {
      expect(revealed[r][3].isRevealed).toBe(true);
      expect(revealed[r][4].isRevealed).toBe(true); // the border itself shows
      expect(revealed[r][5].isRevealed).toBe(false); // nothing behind it
    }
    // Tapping a numbered cell reveals only that cell.
    const single = floodReveal(board, 2, 4).flat();
    expect(single.filter((c) => c.isRevealed)).toHaveLength(1);
  });

  test("flood skips flagged cells and does not spread through them", () => {
    const board = makeEmptyBoard();
    // Wall of flags on column 4 splits the empty board in two.
    for (let r = 0; r < ROWS; r += 1) {
      board[r][4].isFlagged = true;
    }
    const revealed = floodReveal(board, 0, 0);
    for (let r = 0; r < ROWS; r += 1) {
      expect(revealed[r][4].isRevealed).toBe(false);
      expect(revealed[r][3].isRevealed).toBe(true);
      expect(revealed[r][5].isRevealed).toBe(false);
    }
    // Tapping a flagged cell directly reveals nothing.
    const tapped = floodReveal(board, 0, 4);
    expect(tapped.flat().some((c) => c.isRevealed)).toBe(false);
  });

  test("checkWin is false while a safe cell is still hidden", () => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(1));
    expect(checkWin(board)).toBe(false);
  });

  test("revealAllMines reveals every mine and nothing else", () => {
    const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(7));
    const shown = revealAllMines(board).flat();
    expect(shown.filter((c) => c.isRevealed)).toHaveLength(MINE_COUNT);
    expect(shown.filter((c) => c.isMine && !c.isRevealed)).toEqual([]);
  });
});

describe("minesweeper first tap is always safe (many seeds, every position)", () => {
  test("no mine in the tapped cell or any of its neighbours", () => {
    const taps: [number, number][] = [
      [0, 0],
      [0, COLS - 1],
      [ROWS - 1, 0],
      [ROWS - 1, COLS - 1],
      [4, 4],
      [0, 4],
    ];
    for (let seed = 0; seed < 150; seed += 1) {
      for (const [sr, sc] of taps) {
        const board = placeMines(makeEmptyBoard(), sr, sc, mulberry32(seed));
        expect(countMines(board)).toBe(MINE_COUNT);
        const zone = [[sr, sc], ...neighbors(sr, sc)];
        const hit = zone.filter(([r, c]) => board[r][c].isMine);
        expect(hit).toEqual([]);
        expect(board[sr][sc].adjacentMines).toBe(0);
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
  test("a first tap that flood-reveals every safe cell is an instant win", () => {
    // rng 0 packs the mines into the top rows; tapping the far corner floods
    // the whole rest of the board open.
    const { board, result } = resolveTap(
      makeEmptyBoard(),
      8,
      8,
      false,
      () => 0
    );
    expect(checkWin(board)).toBe(true);
    expect(result).toBe("win");
  });

  test("first tap plants mines exactly once and never loses", () => {
    const { board, result } = resolveTap(
      makeEmptyBoard(),
      4,
      4,
      false,
      mulberry32(7)
    );
    expect(result).toBe(checkWin(board) ? "win" : "started");
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
    expect(second.result).toBe(checkWin(second.board) ? "win" : "safe");
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
