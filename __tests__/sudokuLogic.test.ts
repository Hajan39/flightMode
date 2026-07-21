import {
	computeErrors,
	formatTime,
	getBox,
	getCol,
	getRow,
	isPeer,
	isSolved,
} from "@/games/sudoku/logic";
import { PUZZLES } from "@/games/sudoku/puzzles";

describe("sudoku cell coordinates", () => {
	test("getRow/getCol/getBox for known indices", () => {
		expect([getRow(0), getCol(0), getBox(0)]).toEqual([0, 0, 0]);
		expect([getRow(80), getCol(80), getBox(80)]).toEqual([8, 8, 8]);
		expect([getRow(40), getCol(40), getBox(40)]).toEqual([4, 4, 4]);
		expect([getRow(20), getCol(20), getBox(20)]).toEqual([2, 2, 0]);
	});
});

describe("sudoku isPeer", () => {
	test("same row / col / box are peers", () => {
		expect(isPeer(0, 1)).toBe(true); // same row
		expect(isPeer(0, 9)).toBe(true); // same column
		expect(isPeer(0, 10)).toBe(true); // same 3x3 box
	});
	test("a cell is not its own peer", () => {
		expect(isPeer(0, 0)).toBe(false);
	});
	test("unrelated cells are not peers", () => {
		expect(isPeer(0, 80)).toBe(false);
	});
});

describe("sudoku computeErrors", () => {
	const solution = PUZZLES[0].solution;

	test("no errors when the board matches the solution", () => {
		expect(computeErrors(solution, solution).size).toBe(0);
	});
	test("empty (0) cells are never errors", () => {
		const board = solution.map((_, i) => (i < 10 ? 0 : solution[i]));
		expect(computeErrors(board, solution).size).toBe(0);
	});
	test("a filled cell that disagrees with the solution is flagged", () => {
		const board = [...solution];
		const wrong = board[5] === 1 ? 2 : 1;
		board[5] = wrong;
		const errs = computeErrors(board, solution);
		expect(errs.has(5)).toBe(true);
		expect(errs.size).toBe(1);
	});
});

describe("sudoku isSolved", () => {
	const solution = PUZZLES[0].solution;
	test("true when identical", () => {
		expect(isSolved([...solution], solution)).toBe(true);
	});
	test("false when one cell differs or a cell is empty", () => {
		const almost = [...solution];
		almost[0] = 0;
		expect(isSolved(almost, solution)).toBe(false);
	});
});

describe("sudoku formatTime", () => {
	test.each([
		[5, "0:05"],
		[65, "1:05"],
		[600, "10:00"],
		[0, "0:00"],
	])("formats %i seconds as %s", (secs, expected) => {
		expect(formatTime(secs)).toBe(expected);
	});
});
