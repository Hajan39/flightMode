import {
	checkWin,
	COLS,
	countFlagged,
	floodReveal,
	makeEmptyBoard,
	MINE_COUNT,
	placeMines,
	revealAllMines,
	ROWS,
	neighbors,
	type Cell,
} from "@/games/minesweeper/logic";

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
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
				isMine: false,
				isRevealed: false,
				isFlagged: false,
				adjacentMines: 0,
			});
		}
	});

	test("neighbors are clamped to the board (corner has 3, centre has 8)", () => {
		expect(neighbors(0, 0)).toHaveLength(3);
		expect(neighbors(4, 4)).toHaveLength(8);
	});
});

describe("minesweeper placeMines", () => {
	const seeds = [1, 7, 42, 1234, 99999];

	test.each(seeds)("seed %i: plants exactly MINE_COUNT mines", (seed) => {
		const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(seed));
		expect(countMines(board)).toBe(MINE_COUNT);
	});

	test.each(seeds)("seed %i: the first-tap cell and its neighbours are safe", (seed) => {
		const [sr, sc] = [4, 4];
		const board = placeMines(makeEmptyBoard(), sr, sc, mulberry32(seed));
		expect(board[sr][sc].isMine).toBe(false);
		for (const [r, c] of neighbors(sr, sc)) {
			expect(board[r][c].isMine).toBe(false);
		}
	});

	test.each(seeds)("seed %i: adjacency counts match the planted mines", (seed) => {
		const board = placeMines(makeEmptyBoard(), 4, 4, mulberry32(seed));
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				if (board[r][c].isMine) continue;
				const actual = neighbors(r, c).filter(
					([nr, nc]) => board[nr][nc].isMine,
				).length;
				expect(board[r][c].adjacentMines).toBe(actual);
			}
		}
	});
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
			if (cell.isMine) expect(cell.isRevealed).toBe(false);
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
			if (cell.isMine) expect(cell.isRevealed).toBe(true);
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
