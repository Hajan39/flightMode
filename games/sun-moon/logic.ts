// Pure, dependency-free Sun & Moon (Takuzu/Binairo) helpers — extracted from
// the component so they can be unit-tested without React Native.

/** A single cell: sun, moon, or blank. */
export type SunMoonCell = "S" | "M" | ".";

/** Parse level rows ("S"/"M"/".") into a flat cell array (row-major). */
export function parseRows(rows: string[]): SunMoonCell[] {
	const cells: SunMoonCell[] = [];
	for (const row of rows) {
		for (const ch of row) {
			cells.push(ch as SunMoonCell);
		}
	}
	return cells;
}

/** Serialize a flat cell array back into row strings. */
export function serializeRows(cells: SunMoonCell[], size: number): string[] {
	const rows: string[] = [];
	for (let r = 0; r < size; r++) {
		rows.push(cells.slice(r * size, (r + 1) * size).join(""));
	}
	return rows;
}

export const cellIndex = (row: number, col: number, size: number): number =>
	row * size + col;

/**
 * Flat indices of every cell currently involved in a rule violation:
 * - part of a run of 3+ identical symbols in a row or column, or
 * - a symbol that appears more than size/2 times in its row or column.
 * Blank cells are never conflicts.
 */
export function findConflicts(
	cells: SunMoonCell[],
	size: number,
): Set<number> {
	const conflicts = new Set<number>();
	const half = size / 2;

	const checkLine = (indices: number[]) => {
		// Runs of 3+ identical symbols.
		let runStart = 0;
		for (let i = 1; i <= indices.length; i++) {
			const prev = cells[indices[i - 1]];
			const same = i < indices.length && cells[indices[i]] === prev;
			if (!same) {
				const runLen = i - runStart;
				if (runLen >= 3 && prev !== ".") {
					for (let j = runStart; j < i; j++) conflicts.add(indices[j]);
				}
				runStart = i;
			}
		}
		// A symbol used more than half the line length.
		let suns = 0;
		let moons = 0;
		for (const idx of indices) {
			if (cells[idx] === "S") suns++;
			else if (cells[idx] === "M") moons++;
		}
		if (suns > half) {
			for (const idx of indices) if (cells[idx] === "S") conflicts.add(idx);
		}
		if (moons > half) {
			for (const idx of indices) if (cells[idx] === "M") conflicts.add(idx);
		}
	};

	for (let r = 0; r < size; r++) {
		checkLine(Array.from({ length: size }, (_, c) => cellIndex(r, c, size)));
	}
	for (let c = 0; c < size; c++) {
		checkLine(Array.from({ length: size }, (_, r) => cellIndex(r, c, size)));
	}

	return conflicts;
}

/** Every cell is filled (no blanks). */
export function isComplete(cells: SunMoonCell[]): boolean {
	return cells.every((cell) => cell !== ".");
}

/** Complete and free of conflicts — the win condition. */
export function isSolvedGrid(cells: SunMoonCell[], size: number): boolean {
	return isComplete(cells) && findConflicts(cells, size).size === 0;
}

/**
 * Cheap local validity check used by the solver: after placing a symbol at
 * `idx`, does its row/column stay free of triples and half-count overflows?
 */
function placementValid(
	cells: SunMoonCell[],
	size: number,
	idx: number,
): boolean {
	const half = size / 2;
	const row = Math.floor(idx / size);
	const col = idx % size;
	const value = cells[idx];

	const at = (r: number, c: number): SunMoonCell =>
		r < 0 || r >= size || c < 0 || c >= size ? "." : cells[r * size + c];

	// Triples through (row, col) horizontally and vertically.
	for (let offset = -2; offset <= 0; offset++) {
		if (
			at(row, col + offset) === value &&
			at(row, col + offset + 1) === value &&
			at(row, col + offset + 2) === value
		) {
			return false;
		}
		if (
			at(row + offset, col) === value &&
			at(row + offset + 1, col) === value &&
			at(row + offset + 2, col) === value
		) {
			return false;
		}
	}

	// Half-count overflow in the row and column.
	let rowCount = 0;
	let colCount = 0;
	for (let i = 0; i < size; i++) {
		if (at(row, i) === value) rowCount++;
		if (at(i, col) === value) colCount++;
	}
	return rowCount <= half && colCount <= half;
}

/**
 * Count completions of the given grid (rows of "S"/"M"/".") that satisfy both
 * rules, stopping early at `cap`. Backtracking over the first blank cell with
 * triple/half-count pruning. `countSolutions(givens, size) === 1` means the
 * puzzle has a unique solution.
 */
export function countSolutions(
	givens: string[],
	size: number,
	cap = 2,
): number {
	const cells = parseRows(givens);
	let found = 0;

	const solve = (start: number): void => {
		if (found >= cap) return;
		let idx = -1;
		for (let i = start; i < cells.length; i++) {
			if (cells[i] === ".") {
				idx = i;
				break;
			}
		}
		if (idx === -1) {
			found++;
			return;
		}
		for (const value of ["S", "M"] as const) {
			cells[idx] = value;
			if (placementValid(cells, size, idx)) solve(idx + 1);
			cells[idx] = ".";
			if (found >= cap) return;
		}
	};

	solve(0);
	return found;
}
