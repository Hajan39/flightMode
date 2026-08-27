import { NONOGRAM_LEVELS } from "@/games/nonogram/levels";
import {
	countFilledCells,
	deriveClues,
	EMPTY,
	FILLED,
	findForcedCell,
	isLineSatisfied,
	runsOf,
	solveByLineLogic,
	solveLine,
	UNKNOWN,
	type CellState,
} from "@/games/nonogram/logic";

describe("nonogram runsOf", () => {
	test("empty line yields no runs", () => {
		expect(runsOf([false, false, false])).toEqual([]);
	});
	test("full line yields one run", () => {
		expect(runsOf([true, true, true])).toEqual([3]);
	});
	test("mixed line yields ordered runs", () => {
		expect(
			runsOf([true, false, true, true, false, false, true]),
		).toEqual([1, 2, 1]);
	});
});

describe("nonogram deriveClues", () => {
	test("hand-computed 5×5 example", () => {
		const solution = ["..#..", "..#..", "#####", "..#..", ".###."];
		const clues = deriveClues(solution);
		expect(clues.rows).toEqual([[1], [1], [5], [1], [3]]);
		expect(clues.cols).toEqual([[1], [1, 1], [5], [1, 1], [1]]);
	});
	test("empty row/column clues are []", () => {
		const clues = deriveClues(["#..", "...", "#.#"]);
		expect(clues.rows).toEqual([[1], [], [1, 1]]);
		expect(clues.cols).toEqual([[1, 1], [], [1]]);
	});
});

describe("nonogram isLineSatisfied", () => {
	test("matching runs satisfy the clue", () => {
		expect(isLineSatisfied([2, 1], [true, true, false, true, false])).toBe(
			true,
		);
	});
	test("wrong run lengths do not satisfy", () => {
		expect(isLineSatisfied([2, 1], [true, false, false, true, false])).toBe(
			false,
		);
	});
	test("empty clue is satisfied only by an empty line", () => {
		expect(isLineSatisfied([], [false, false])).toBe(true);
		expect(isLineSatisfied([], [true, false])).toBe(false);
	});
});

describe("nonogram solveLine", () => {
	const U = UNKNOWN as CellState;

	test("full-width run is fully determined", () => {
		expect(solveLine([5], [U, U, U, U, U])).toEqual([
			FILLED,
			FILLED,
			FILLED,
			FILLED,
			FILLED,
		]);
	});
	test("overlap logic: [3] in 5 cells pins the center", () => {
		expect(solveLine([3], [U, U, U, U, U])).toEqual([
			UNKNOWN,
			UNKNOWN,
			FILLED,
			UNKNOWN,
			UNKNOWN,
		]);
	});
	test("[2,2] in 5 cells is fully determined", () => {
		expect(solveLine([2, 2], [U, U, U, U, U])).toEqual([
			FILLED,
			FILLED,
			EMPTY,
			FILLED,
			FILLED,
		]);
	});
	test("empty clue empties the whole line", () => {
		expect(solveLine([], [U, U, U])).toEqual([EMPTY, EMPTY, EMPTY]);
	});
	test("known cells constrain placements", () => {
		// [2] in 4 cells with cell 0 known empty → run sits in cells 1..3,
		// so cell 2 is shared by both remaining placements.
		expect(solveLine([2], [EMPTY, U, U, U])).toEqual([
			EMPTY,
			UNKNOWN,
			FILLED,
			UNKNOWN,
		]);
	});
	test("contradiction returns null", () => {
		expect(solveLine([4], [EMPTY, U, U, U])).toBeNull();
		expect(solveLine([], [FILLED, U])).toBeNull();
	});
});

describe("nonogram levels", () => {
	test("ids are unique and sequential from 1", () => {
		const ids = NONOGRAM_LEVELS.map((l) => l.id);
		expect(new Set(ids).size).toBe(NONOGRAM_LEVELS.length);
		expect(ids).toEqual(
			Array.from({ length: NONOGRAM_LEVELS.length }, (_, i) => i + 1),
		);
	});

	test("there are 15 levels tiered 5×5 (1–4), 8×8 (5–7), 10×10 (8–15)", () => {
		expect(NONOGRAM_LEVELS).toHaveLength(15);
		for (const level of NONOGRAM_LEVELS) {
			const expectedSize = level.id <= 4 ? 5 : level.id <= 7 ? 8 : 10;
			expect(level.size).toBe(expectedSize);
		}
	});

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i is well-formed",
		(_id, level) => {
			expect(level.solution).toHaveLength(level.size);
			for (const row of level.solution) {
				expect(row).toHaveLength(level.size);
				expect(row).toMatch(/^[#.]+$/);
			}
		},
	);

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i has at least one filled and one empty cell",
		(_id, level) => {
			const filled = countFilledCells(level.solution);
			expect(filled).toBeGreaterThan(0);
			expect(filled).toBeLessThan(level.size * level.size);
		},
	);

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i clue sums equal the filled-cell count",
		(_id, level) => {
			const clues = deriveClues(level.solution);
			const rowSum = clues.rows.flat().reduce((a, b) => a + b, 0);
			const colSum = clues.cols.flat().reduce((a, b) => a + b, 0);
			const filled = countFilledCells(level.solution);
			expect(rowSum).toBe(filled);
			expect(colSum).toBe(filled);
		},
	);

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i is solvable by pure line logic and matches its stored solution",
		(_id, level) => {
			const clues = deriveClues(level.solution);
			const solved = solveByLineLogic(clues, level.size);
			expect(solved).not.toBeNull();
			// Guess-free line solving reaching a full grid also proves the
			// stored solution is the unique solution of its clues.
			expect(solved).toEqual(level.solution);
		},
	);
});

describe("nonogram findForcedCell", () => {
	const emptyGrid = (size: number): CellState[][] =>
		Array.from({ length: size }, () =>
			new Array<CellState>(size).fill(UNKNOWN),
		);

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i: first hint from an empty grid matches the stored solution",
		(_id, level) => {
			const clues = deriveClues(level.solution);
			const forced = findForcedCell(clues, emptyGrid(level.size));
			expect(forced).not.toBeNull();
			if (!forced) return;
			expect(forced.state === FILLED || forced.state === EMPTY).toBe(true);
			const solutionState =
				level.solution[forced.r][forced.c] === "#" ? FILLED : EMPTY;
			expect(forced.state).toBe(solutionState);
		},
	);

	test.each(NONOGRAM_LEVELS.map((l) => [l.id, l] as const))(
		"level %i: repeatedly applying hints from empty solves the whole puzzle",
		(_id, level) => {
			const clues = deriveClues(level.solution);
			const grid = emptyGrid(level.size);
			const maxSteps = level.size * level.size;
			for (let step = 0; step < maxSteps; step++) {
				const forced = findForcedCell(clues, grid);
				if (!forced) break;
				// Every deduction must target an unknown cell and be correct.
				expect(grid[forced.r][forced.c]).toBe(UNKNOWN);
				const solutionState =
					level.solution[forced.r][forced.c] === "#" ? FILLED : EMPTY;
				expect(forced.state).toBe(solutionState);
				grid[forced.r][forced.c] = forced.state;
			}
			// Hint-by-hint solving must reach the same full grid as
			// solveByLineLogic (equivalence: no cell left undecided).
			const picture = grid.map((row) =>
				row.map((cell) => (cell === FILLED ? "#" : ".")).join(""),
			);
			expect(grid.flat()).not.toContain(UNKNOWN);
			expect(picture).toEqual(level.solution);
		},
	);

	test("returns null on a completed grid", () => {
		const level = NONOGRAM_LEVELS[0];
		const clues = deriveClues(level.solution);
		const grid: CellState[][] = level.solution.map((row) =>
			[...row].map((ch) => (ch === "#" ? FILLED : EMPTY)),
		);
		expect(findForcedCell(clues, grid)).toBeNull();
	});
});
