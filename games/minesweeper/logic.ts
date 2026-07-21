// Pure, dependency-free Minesweeper board logic — extracted from the component
// so mine placement, flood-reveal, and win detection can be unit-tested.

export const ROWS = 9;
export const COLS = 9;
export const MINE_COUNT = 10;

export type Cell = {
	isMine: boolean;
	isRevealed: boolean;
	isFlagged: boolean;
	adjacentMines: number;
};

export function makeEmptyBoard(): Cell[][] {
	return Array.from({ length: ROWS }, () =>
		Array.from({ length: COLS }, () => ({
			isMine: false,
			isRevealed: false,
			isFlagged: false,
			adjacentMines: 0,
		})),
	);
}

export function neighbors(row: number, col: number): [number, number][] {
	const result: [number, number][] = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) continue;
			const r = row + dr;
			const c = col + dc;
			if (r >= 0 && r < ROWS && c >= 0 && c < COLS) result.push([r, c]);
		}
	}
	return result;
}

/**
 * Plant MINE_COUNT mines avoiding the tapped cell and its 8 neighbours (so the
 * first tap is always safe), then compute adjacency counts. `rng` is injectable
 * for deterministic tests.
 */
export function placeMines(
	board: Cell[][],
	safeRow: number,
	safeCol: number,
	rng: () => number = Math.random,
): Cell[][] {
	const forbidden = new Set<string>();
	forbidden.add(`${safeRow},${safeCol}`);
	for (const [r, c] of neighbors(safeRow, safeCol)) {
		forbidden.add(`${r},${c}`);
	}

	const eligible: [number, number][] = [];
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			if (!forbidden.has(`${r},${c}`)) eligible.push([r, c]);
		}
	}

	// Fisher-Yates partial shuffle to pick MINE_COUNT positions.
	for (let i = 0; i < MINE_COUNT; i++) {
		const j = i + Math.floor(rng() * (eligible.length - i));
		[eligible[i], eligible[j]] = [eligible[j], eligible[i]];
	}

	const next: Cell[][] = board.map((row) => row.map((cell) => ({ ...cell })));
	for (let i = 0; i < MINE_COUNT; i++) {
		const [r, c] = eligible[i];
		next[r][c] = { ...next[r][c], isMine: true };
	}

	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			if (next[r][c].isMine) continue;
			const count = neighbors(r, c).filter(
				([nr, nc]) => next[nr][nc].isMine,
			).length;
			next[r][c] = { ...next[r][c], adjacentMines: count };
		}
	}

	return next;
}

export function floodReveal(
	board: Cell[][],
	startRow: number,
	startCol: number,
): Cell[][] {
	const next: Cell[][] = board.map((row) => row.map((cell) => ({ ...cell })));
	const queue: [number, number][] = [[startRow, startCol]];
	const visited = new Set<string>();
	visited.add(`${startRow},${startCol}`);

	while (queue.length > 0) {
		const [r, c] = queue.shift() as [number, number];
		const cell = next[r][c];
		if (cell.isFlagged || cell.isRevealed) continue;
		next[r][c] = { ...cell, isRevealed: true };

		if (cell.adjacentMines === 0) {
			for (const [nr, nc] of neighbors(r, c)) {
				const key = `${nr},${nc}`;
				if (
					!visited.has(key) &&
					!next[nr][nc].isMine &&
					!next[nr][nc].isRevealed
				) {
					visited.add(key);
					queue.push([nr, nc]);
				}
			}
		}
	}

	return next;
}

export function revealAllMines(board: Cell[][]): Cell[][] {
	return board.map((row) =>
		row.map((cell) => (cell.isMine ? { ...cell, isRevealed: true } : cell)),
	);
}

/** Win = every non-mine cell revealed. */
export function checkWin(board: Cell[][]): boolean {
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const cell = board[r][c];
			if (!cell.isMine && !cell.isRevealed) return false;
		}
	}
	return true;
}

export function countFlagged(board: Cell[][]): number {
	let count = 0;
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			if (board[r][c].isFlagged) count++;
		}
	}
	return count;
}
