// Pure, dependency-free Sudoku helpers — extracted from the component so they
// can be unit-tested without React Native.

export const getRow = (i: number): number => Math.floor(i / 9);
export const getCol = (i: number): number => i % 9;
export const getBox = (i: number): number =>
	Math.floor(getRow(i) / 3) * 3 + Math.floor(getCol(i) / 3);

/** Two distinct cells are peers if they share a row, column, or 3×3 box. */
export function isPeer(a: number, b: number): boolean {
	return (
		a !== b &&
		(getRow(a) === getRow(b) ||
			getCol(a) === getCol(b) ||
			getBox(a) === getBox(b))
	);
}

/** Indices of filled cells whose value disagrees with the known solution. */
export function computeErrors(board: number[], solution: number[]): Set<number> {
	const errs = new Set<number>();
	board.forEach((v, i) => {
		if (v !== 0 && v !== solution[i]) errs.add(i);
	});
	return errs;
}

/** The board matches the solution in every cell. */
export function isSolved(board: number[], solution: number[]): boolean {
	return board.length === solution.length && board.every((v, i) => v === solution[i]);
}

export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}
