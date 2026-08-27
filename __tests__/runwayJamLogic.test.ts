import { LEVELS } from "@/games/runway-jam/levels";
import {
	GRID_SIZE,
	PLANE_ID,
	applyMove,
	isSolved,
	nextOptimalMove,
	reachablePositions,
	solveBFS,
	validateLevel,
} from "@/games/runway-jam/logic";

describe("runway jam levels", () => {
	test("there are exactly 18 levels with sequential ids", () => {
		expect(LEVELS).toHaveLength(18);
		expect(LEVELS.map((l) => l.id)).toEqual(
			Array.from({ length: 18 }, (_, i) => i + 1),
		);
	});

	test.each(LEVELS.map((l) => [l.id, l] as const))(
		"level %i is valid",
		(_id, level) => {
			expect(validateLevel(level.pieces)).toBeNull();
		},
	);

	test.each(LEVELS.map((l) => [l.id, l] as const))(
		"level %i has unique piece ids",
		(_id, level) => {
			const ids = level.pieces.map((p) => p.id);
			expect(new Set(ids).size).toBe(ids.length);
		},
	);

	test.each(LEVELS.map((l) => [l.id, l] as const))(
		"level %i is solvable and minMoves is the exact optimum",
		(_id, level) => {
			const optimal = solveBFS(level.pieces);
			expect(typeof optimal).toBe("number");
			expect(optimal).toBe(level.minMoves);
		},
	);

	test("tier bounds hold (1-4 easy <= 8, 9-12 hard >= 12, 13-18 expert >= 16)", () => {
		for (const level of LEVELS) {
			if (level.id <= 4) expect(level.minMoves).toBeLessThanOrEqual(8);
			if (level.id >= 9) expect(level.minMoves).toBeGreaterThanOrEqual(12);
			if (level.id >= 13) expect(level.minMoves).toBeGreaterThanOrEqual(16);
		}
	});

	test("expert tier (13-18) minMoves is non-decreasing", () => {
		const expert = LEVELS.filter((l) => l.id >= 13);
		expect(expert).toHaveLength(6);
		for (let i = 1; i < expert.length; i++) {
			expect(expert[i].minMoves).toBeGreaterThanOrEqual(
				expert[i - 1].minMoves,
			);
		}
	});
});

describe("runway jam nextOptimalMove", () => {
	test.each(LEVELS.map((l) => [l.id, l] as const))(
		"level %i is solved by repeated hints in exactly minMoves moves",
		(_id, level) => {
			let state = level.pieces.map((p) => ({ ...p }));
			let moves = 0;
			while (!isSolved(state)) {
				const move = nextOptimalMove(state);
				expect(move).not.toBeNull();
				if (move === null) return;
				state = applyMove(state, move.id, move.row, move.col);
				moves++;
				expect(moves).toBeLessThanOrEqual(level.minMoves);
			}
			expect(moves).toBe(level.minMoves);
		},
	);

	test("returns null on a solved board", () => {
		const solved = [
			{ id: PLANE_ID, row: 2, col: GRID_SIZE - 2, len: 2, horiz: true },
		];
		expect(isSolved(solved)).toBe(true);
		expect(nextOptimalMove(solved)).toBeNull();
	});
});

describe("runway jam applyMove / isSolved", () => {
	// Plane at (2,0) with a single vertical blocker in front of the exit.
	const board = [
		{ id: PLANE_ID, row: 2, col: 0, len: 2, horiz: true },
		{ id: 1, row: 0, col: 4, len: 3, horiz: false },
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
			validateLevel([{ id: 1, row: 0, col: 0, len: 2, horiz: true }]),
		).not.toBeNull();
	});

	test("rejects a plane off row 2 or vertical", () => {
		expect(
			validateLevel([{ id: 0, row: 1, col: 0, len: 2, horiz: true }]),
		).not.toBeNull();
		expect(
			validateLevel([{ id: 0, row: 2, col: 0, len: 2, horiz: false }]),
		).not.toBeNull();
	});

	test("rejects overlaps, out-of-bounds pieces and duplicate ids", () => {
		const plane = { id: 0, row: 2, col: 0, len: 2, horiz: true };
		expect(
			validateLevel([plane, { id: 1, row: 2, col: 1, len: 2, horiz: false }]),
		).not.toBeNull();
		expect(
			validateLevel([plane, { id: 1, row: 4, col: 5, len: 3, horiz: true }]),
		).not.toBeNull();
		expect(
			validateLevel([plane, { id: 0, row: 0, col: 0, len: 2, horiz: true }]),
		).not.toBeNull();
	});
});
