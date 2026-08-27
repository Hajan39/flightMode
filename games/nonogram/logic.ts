// ─── Sky Pixels (nonogram) — pure puzzle logic ───────────────────────────────
//
// This module is intentionally free of ALL React / React Native imports so it
// can be unit-tested in isolation. Everything here is deterministic and pure.

/** Cell states used by the solver and the UI board. */
export const UNKNOWN = -1;
export const EMPTY = 0;
export const FILLED = 1;

export type CellState = typeof UNKNOWN | typeof EMPTY | typeof FILLED;

/** Number clues for every row and column, in reading order. */
export type Clues = { rows: number[][]; cols: number[][] };

/**
 * Returns the run-lengths of consecutive `true` values in a line.
 * An all-empty line yields `[]` (the UI renders that as "0").
 */
export function runsOf(line: boolean[]): number[] {
	const runs: number[] = [];
	let current = 0;
	for (const filled of line) {
		if (filled) {
			current++;
		} else if (current > 0) {
			runs.push(current);
			current = 0;
		}
	}
	if (current > 0) runs.push(current);
	return runs;
}

/**
 * Derives the row and column clues from a solution picture.
 * `solution` is a list of equal-length strings using "#" (filled) / "." (empty).
 */
export function deriveClues(solution: string[]): Clues {
	const size = solution.length;
	const rows = solution.map((row) => runsOf([...row].map((ch) => ch === "#")));
	const cols: number[][] = [];
	for (let c = 0; c < size; c++) {
		cols.push(runsOf(solution.map((row) => row[c] === "#")));
	}
	return { rows, cols };
}

/** Total number of filled cells a clue set implies (sum of all row runs). */
export function countFilledCells(solution: string[]): number {
	let count = 0;
	for (const row of solution) {
		for (const ch of row) if (ch === "#") count++;
	}
	return count;
}

/**
 * True when the filled cells of a line exactly produce the given clue.
 * `clue` may be `[]` for an empty line.
 */
export function isLineSatisfied(clue: number[], filled: boolean[]): boolean {
	const runs = runsOf(filled);
	const expected = clue.filter((n) => n > 0);
	if (runs.length !== expected.length) return false;
	return runs.every((run, i) => run === expected[i]);
}

/**
 * Single-line solver: enumerates every placement of `clue` that is consistent
 * with the current `cells` (UNKNOWN / EMPTY / FILLED) and returns the
 * intersection — cells that are FILLED or EMPTY in ALL valid placements are
 * determined; the rest stay UNKNOWN. Returns null when no placement fits
 * (a contradiction). Lines are ≤ 10 cells, so direct enumeration is cheap.
 */
export function solveLine(
	clue: number[],
	cells: CellState[],
): CellState[] | null {
	const n = cells.length;
	const runs = clue.filter((c) => c > 0);

	// canBeFilled / canBeEmpty per cell, across all valid placements.
	const canFill = new Array<boolean>(n).fill(false);
	const canEmpty = new Array<boolean>(n).fill(false);
	let found = false;

	const line = new Array<boolean>(n).fill(false);

	const emit = () => {
		found = true;
		for (let i = 0; i < n; i++) {
			if (line[i]) canFill[i] = true;
			else canEmpty[i] = true;
		}
	};

	// Places runs[runIdx..] starting at cell `start`; cells before `start`
	// are already decided in `line`.
	const place = (runIdx: number, start: number): void => {
		if (runIdx === runs.length) {
			// Remaining cells must all be empty.
			for (let i = start; i < n; i++) {
				if (cells[i] === FILLED) return;
			}
			for (let i = start; i < n; i++) line[i] = false;
			emit();
			return;
		}

		const len = runs[runIdx];
		const restLen = runs
			.slice(runIdx + 1)
			.reduce((sum, r) => sum + r + 1, 0);
		const lastStart = n - restLen - len;

		for (let pos = start; pos <= lastStart; pos++) {
			// Cell just before the run (gap) must not be forced-filled — the
			// loop naturally covers this: any skipped cell must allow empty.
			if (pos > start && cells[pos - 1] === FILLED) break;

			// Cells start..pos-1 are gaps (empty).
			let ok = true;
			for (let i = start; i < pos; i++) {
				if (cells[i] === FILLED) {
					ok = false;
					break;
				}
			}
			if (!ok) continue;

			// The run itself must not overlap a known-empty cell.
			for (let i = pos; i < pos + len; i++) {
				if (cells[i] === EMPTY) {
					ok = false;
					break;
				}
			}
			if (!ok) continue;

			// Separator after the run (when another run follows).
			const after = pos + len;
			const needsGap = runIdx < runs.length - 1;
			if (needsGap && cells[after] === FILLED) continue;

			for (let i = start; i < pos; i++) line[i] = false;
			for (let i = pos; i < pos + len; i++) line[i] = true;
			if (needsGap) {
				line[after] = false;
				place(runIdx + 1, after + 1);
			} else {
				place(runIdx + 1, after);
			}
		}
	};

	place(0, 0);
	if (!found) return null;

	const result: CellState[] = new Array(n);
	for (let i = 0; i < n; i++) {
		if (canFill[i] && !canEmpty[i]) result[i] = FILLED;
		else if (canEmpty[i] && !canFill[i]) result[i] = EMPTY;
		else result[i] = UNKNOWN;
	}
	return result;
}

/** A single cell deduction produced by `findForcedCell`. */
export type ForcedCell = { r: number; c: number; state: CellState };

/**
 * Runs one pass of line deduction over the current grid and returns ONE cell
 * that is currently UNKNOWN but logically forced by a row or column clue.
 * Prefers a FILLED deduction over an EMPTY one when both exist; otherwise
 * returns the first deduction found (rows scanned before columns, reading
 * order). Returns null when no cell is forced — e.g. the grid is complete.
 * Lines that currently contradict their clue (bad user marks) are skipped.
 */
export function findForcedCell(
	clues: Clues,
	grid: CellState[][],
): ForcedCell | null {
	const size = grid.length;
	let firstEmpty: ForcedCell | null = null;

	for (let r = 0; r < size; r++) {
		const solved = solveLine(clues.rows[r], grid[r]);
		if (!solved) continue;
		for (let c = 0; c < size; c++) {
			if (grid[r][c] !== UNKNOWN || solved[c] === UNKNOWN) continue;
			if (solved[c] === FILLED) return { r, c, state: FILLED };
			if (!firstEmpty) firstEmpty = { r, c, state: EMPTY };
		}
	}

	for (let c = 0; c < size; c++) {
		const column = grid.map((row) => row[c]);
		const solved = solveLine(clues.cols[c], column);
		if (!solved) continue;
		for (let r = 0; r < size; r++) {
			if (grid[r][c] !== UNKNOWN || solved[r] === UNKNOWN) continue;
			if (solved[r] === FILLED) return { r, c, state: FILLED };
			if (!firstEmpty) firstEmpty = { r, c, state: EMPTY };
		}
	}

	return firstEmpty;
}

/**
 * Solves a whole puzzle using row/column line logic only, iterating to a
 * fixpoint. Returns the solved picture in the same "#"/"." string format as
 * level solutions, or null when the puzzle stalls (would require guessing)
 * or contains a contradiction. A non-null result also proves the solution
 * is unique.
 */
export function solveByLineLogic(clues: Clues, size: number): string[] | null {
	const grid: CellState[][] = Array.from({ length: size }, () =>
		new Array<CellState>(size).fill(UNKNOWN),
	);

	let changed = true;
	while (changed) {
		changed = false;

		for (let r = 0; r < size; r++) {
			const solved = solveLine(clues.rows[r], grid[r]);
			if (!solved) return null;
			for (let c = 0; c < size; c++) {
				if (solved[c] !== UNKNOWN && grid[r][c] !== solved[c]) {
					grid[r][c] = solved[c];
					changed = true;
				}
			}
		}

		for (let c = 0; c < size; c++) {
			const column = grid.map((row) => row[c]);
			const solved = solveLine(clues.cols[c], column);
			if (!solved) return null;
			for (let r = 0; r < size; r++) {
				if (solved[r] !== UNKNOWN && grid[r][c] !== solved[r]) {
					grid[r][c] = solved[r];
					changed = true;
				}
			}
		}
	}

	for (const row of grid) {
		if (row.includes(UNKNOWN)) return null;
	}
	return grid.map((row) =>
		row.map((cell) => (cell === FILLED ? "#" : ".")).join(""),
	);
}
