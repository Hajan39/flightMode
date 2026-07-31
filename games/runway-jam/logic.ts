// Pure, dependency-free Runway Jam (Rush Hour-style) helpers — extracted from
// the component so they can be unit-tested without React Native.

export type Piece = {
	/** Unique id; 0 is always the plane. */
	id: number;
	/** Row of the piece origin (top-most / left-most cell). */
	row: number;
	/** Column of the piece origin (top-most / left-most cell). */
	col: number;
	/** Length in cells (2 or 3). */
	len: number;
	/** True = horizontal (slides along its row), false = vertical. */
	horiz: boolean;
};

export type Level = {
	id: number;
	/** Proven optimal number of moves (see solveBFS). */
	minMoves: number;
	pieces: Piece[];
};

export const GRID_SIZE = 6;
export const PLANE_ID = 0;
export const PLANE_ROW = 2;
export const PLANE_LEN = 2;

/** All cells occupied by a piece. */
export function pieceCells(piece: Piece): { row: number; col: number }[] {
	const cells: { row: number; col: number }[] = [];
	for (let k = 0; k < piece.len; k++) {
		cells.push({
			row: piece.horiz ? piece.row : piece.row + k,
			col: piece.horiz ? piece.col + k : piece.col,
		});
	}
	return cells;
}

/** GRID_SIZE×GRID_SIZE occupancy grid: piece id per cell, -1 = empty. */
export function buildGrid(pieces: Piece[]): number[][] {
	const grid = Array.from({ length: GRID_SIZE }, () =>
		Array<number>(GRID_SIZE).fill(-1),
	);
	for (const piece of pieces) {
		for (const cell of pieceCells(piece)) {
			grid[cell.row][cell.col] = piece.id;
		}
	}
	return grid;
}

/**
 * Validates a level layout. Returns `null` when valid, otherwise a short
 * description of the first problem found.
 */
export function validateLevel(pieces: Piece[]): string | null {
	if (pieces.length === 0) return "no pieces";

	const ids = new Set<number>();
	for (const piece of pieces) {
		if (ids.has(piece.id)) return `duplicate id ${piece.id}`;
		ids.add(piece.id);
		if (piece.len !== 2 && piece.len !== 3) {
			return `piece ${piece.id} has invalid length ${piece.len}`;
		}
		for (const cell of pieceCells(piece)) {
			if (
				cell.row < 0 ||
				cell.row >= GRID_SIZE ||
				cell.col < 0 ||
				cell.col >= GRID_SIZE
			) {
				return `piece ${piece.id} is out of bounds`;
			}
		}
	}

	const plane = pieces.find((p) => p.id === PLANE_ID);
	if (!plane) return "missing plane (id 0)";
	if (!plane.horiz || plane.len !== PLANE_LEN || plane.row !== PLANE_ROW) {
		return "plane must be horizontal, length 2, on row 2";
	}

	// Overlap check via occupancy counting.
	const seen = new Set<number>();
	for (const piece of pieces) {
		for (const cell of pieceCells(piece)) {
			const key = cell.row * GRID_SIZE + cell.col;
			if (seen.has(key)) return `pieces overlap at (${cell.row},${cell.col})`;
			seen.add(key);
		}
	}

	return null;
}

/**
 * All origin positions the piece can slide to along its axis (any distance,
 * each counts as one move). The current position is not included.
 */
export function reachablePositions(
	pieces: Piece[],
	id: number,
): { row: number; col: number }[] {
	const piece = pieces.find((p) => p.id === id);
	if (!piece) return [];
	const grid = buildGrid(pieces);
	const positions: { row: number; col: number }[] = [];

	if (piece.horiz) {
		for (let c = piece.col - 1; c >= 0 && grid[piece.row][c] === -1; c--) {
			positions.push({ row: piece.row, col: c });
		}
		for (
			let c = piece.col + piece.len;
			c < GRID_SIZE && grid[piece.row][c] === -1;
			c++
		) {
			positions.push({ row: piece.row, col: c - piece.len + 1 });
		}
	} else {
		for (let r = piece.row - 1; r >= 0 && grid[r][piece.col] === -1; r--) {
			positions.push({ row: r, col: piece.col });
		}
		for (
			let r = piece.row + piece.len;
			r < GRID_SIZE && grid[r][piece.col] === -1;
			r++
		) {
			positions.push({ row: r - piece.len + 1, col: piece.col });
		}
	}

	return positions;
}

/**
 * Returns a new pieces array with the given piece moved to (row, col).
 * Legality is the caller's responsibility — use `reachablePositions`.
 */
export function applyMove(
	pieces: Piece[],
	id: number,
	row: number,
	col: number,
): Piece[] {
	return pieces.map((p) => (p.id === id ? { ...p, row, col } : p));
}

/** The plane has reached the right edge of the board (the exit). */
export function isSolved(pieces: Piece[]): boolean {
	const plane = pieces.find((p) => p.id === PLANE_ID);
	if (!plane) return false;
	return plane.horiz && plane.col + plane.len === GRID_SIZE;
}

/**
 * Breadth-first search over board states. Returns the minimum number of
 * moves needed to solve the level, or `null` when it is unsolvable or the
 * layout is invalid. State key = the variable coordinate of every piece
 * (the fixed coordinate, length and axis never change).
 */
export function solveBFS(pieces: Piece[]): number | null {
	if (validateLevel(pieces) !== null) return null;

	const start = [...pieces].sort((a, b) => a.id - b.id);
	const keyOf = (state: Piece[]) =>
		state.map((p) => (p.horiz ? p.col : p.row)).join(",");

	if (isSolved(start)) return 0;

	const visited = new Set<string>([keyOf(start)]);
	let frontier: Piece[][] = [start];
	let depth = 0;

	while (frontier.length > 0) {
		depth++;
		const next: Piece[][] = [];
		for (const state of frontier) {
			for (const piece of state) {
				for (const pos of reachablePositions(state, piece.id)) {
					const moved = applyMove(state, piece.id, pos.row, pos.col);
					const key = keyOf(moved);
					if (visited.has(key)) continue;
					visited.add(key);
					if (isSolved(moved)) return depth;
					next.push(moved);
				}
			}
		}
		frontier = next;
	}

	return null;
}
