import { LEVELS } from "@/games/sun-moon/levels";
import {
	countSolutions,
	findConflicts,
	getHintCell,
	isComplete,
	isSolvedGrid,
	parseRows,
	serializeRows,
	type SunMoonCell,
} from "@/games/sun-moon/logic";

describe("sun-moon parse/serialize", () => {
	test("round-trips level rows", () => {
		const rows = ["SM..", "..MS", "SM.M", "M.S."];
		expect(serializeRows(parseRows(rows), 4)).toEqual(rows);
	});
});

describe("sun-moon findConflicts", () => {
	test("valid complete grid has no conflicts", () => {
		const grid = parseRows(["SMSM", "MSMS", "SMSM", "MSMS"]);
		expect(findConflicts(grid, 4).size).toBe(0);
	});

	test("flags a horizontal triple", () => {
		const grid = parseRows(["SSS.", "....", "....", "...."]);
		const conflicts = findConflicts(grid, 4);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(1)).toBe(true);
		expect(conflicts.has(2)).toBe(true);
		expect(conflicts.has(3)).toBe(false);
	});

	test("flags a vertical triple", () => {
		const grid = parseRows(["M...", "M...", "M...", "...."]);
		const conflicts = findConflicts(grid, 4);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(4)).toBe(true);
		expect(conflicts.has(8)).toBe(true);
		expect(conflicts.size).toBe(3);
	});

	test("flags an unbalanced row (more than half of one symbol)", () => {
		// Three suns in a 4-wide row exceeds the max of two, without a triple.
		const grid = parseRows(["SSMS", "....", "....", "...."]);
		const conflicts = findConflicts(grid, 4);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(1)).toBe(true);
		expect(conflicts.has(3)).toBe(true);
		expect(conflicts.has(2)).toBe(false);
	});

	test("blank cells are never conflicts", () => {
		const grid = parseRows(["....", "....", "....", "...."]);
		expect(findConflicts(grid, 4).size).toBe(0);
	});
});

describe("sun-moon isComplete / isSolvedGrid", () => {
	test("isComplete detects blanks", () => {
		expect(isComplete(parseRows(["SM", "MS"]))).toBe(true);
		expect(isComplete(parseRows(["SM", "M."]))).toBe(false);
	});

	test("isSolvedGrid requires completeness and zero conflicts", () => {
		expect(isSolvedGrid(parseRows(["SM", "MS"]), 2)).toBe(true);
		expect(isSolvedGrid(parseRows(["SM", "M."]), 2)).toBe(false);
		expect(isSolvedGrid(parseRows(["SS", "MM"]), 2)).toBe(false);
	});
});

describe("sun-moon countSolutions", () => {
	test("a fully blank 4x4 grid is ambiguous (capped at 2)", () => {
		expect(countSolutions(["....", "....", "....", "...."], 4, 2)).toBe(2);
	});

	test("a complete valid grid counts as exactly one solution", () => {
		expect(countSolutions(["SMSM", "MSMS", "SMSM", "MSMS"], 4)).toBe(1);
	});

	test("an unsolvable givens set counts zero solutions", () => {
		// Note: the SSS triple itself is inside the givens and is NOT what the
		// solver rejects (placement validation only checks lines through newly
		// placed cells). This counts 0 because the column budgets make the
		// remaining suns arithmetically impossible: cols 0-2 each already hold
		// an S (max 2 per column in 4x4), and rows 1-3 each need 2 suns.
		expect(countSolutions(["SSS.", "....", "....", "...."], 4)).toBe(0);
	});
});

describe("sun-moon levels integrity", () => {
	test("ids are unique and sequential", () => {
		const ids = LEVELS.map((lvl) => lvl.id);
		expect(new Set(ids).size).toBe(LEVELS.length);
		expect(ids).toEqual(Array.from({ length: LEVELS.length }, (_, i) => i + 1));
	});

	test("has 16 levels tiered 4x4 / 6x6 / 8x8", () => {
		expect(LEVELS).toHaveLength(16);
		for (const lvl of LEVELS) {
			const expectedSize = lvl.id <= 4 ? 4 : lvl.id <= 8 ? 6 : 8;
			expect(lvl.size).toBe(expectedSize);
		}
	});

	test.each(LEVELS.map((lvl) => [lvl.id, lvl] as const))(
		"level %i solution and givens are well-formed",
		(_id, lvl) => {
			const { size, solution, givens } = lvl;

			// Shape.
			expect(solution).toHaveLength(size);
			expect(givens).toHaveLength(size);
			for (const row of solution) expect(row).toMatch(/^[SM]+$/);
			for (const row of givens) expect(row).toMatch(/^[SM.]+$/);
			for (const row of [...solution, ...givens]) {
				expect(row).toHaveLength(size);
			}

			// Solution satisfies both rules and is complete.
			const solutionCells = parseRows(solution);
			expect(isComplete(solutionCells)).toBe(true);
			expect(findConflicts(solutionCells, size).size).toBe(0);
			expect(isSolvedGrid(solutionCells, size)).toBe(true);

			// Givens are a strict subset of the solution.
			const givenCells = parseRows(givens);
			let blanks = 0;
			givenCells.forEach((cell, i) => {
				if (cell === ".") blanks++;
				else expect(cell).toBe(solutionCells[i]);
			});
			expect(blanks).toBeGreaterThan(0);

			// Blank budget: at least 25% everywhere, at least 50% on the 8x8 tier.
			const total = size * size;
			expect(blanks).toBeGreaterThanOrEqual(Math.ceil(total * 0.25));
			if (size === 8) {
				expect(blanks).toBeGreaterThanOrEqual(total * 0.5);
			}

			// EXACTLY one solution.
			expect(countSolutions(givens, size, 2)).toBe(1);
		},
	);

	test("blank counts increase within each tier", () => {
		const blanksOf = (rows: string[]) =>
			rows.join("").split("").filter((ch) => ch === ".").length;
		for (let i = 1; i < LEVELS.length; i++) {
			if (LEVELS[i].size !== LEVELS[i - 1].size) continue;
			expect(blanksOf(LEVELS[i].givens)).toBeGreaterThan(
				blanksOf(LEVELS[i - 1].givens),
			);
		}
	});

	test("expansion levels 13-16 are 8x8 and blanker than levels 9-12", () => {
		const blanksOf = (rows: string[]) =>
			rows.join("").split("").filter((ch) => ch === ".").length;
		const expansion = LEVELS.filter((lvl) => lvl.id >= 13);
		expect(expansion).toHaveLength(4);
		for (const lvl of expansion) {
			expect(lvl.size).toBe(8);
			expect(blanksOf(lvl.givens)).toBeGreaterThan(44);
		}
	});
});

describe("sun-moon getHintCell", () => {
	test("repeatedly applying hints solves every level from its givens", () => {
		for (const lvl of LEVELS) {
			const cells: SunMoonCell[] = parseRows(lvl.givens);
			const solutionCells = parseRows(lvl.solution);
			// Each hint fills/corrects one cell, so at most size² steps.
			for (let step = 0; step <= lvl.size * lvl.size; step++) {
				const hint = getHintCell(cells, lvl);
				if (hint === null) break;
				expect(hint.value).toBe(solutionCells[hint.index]);
				cells[hint.index] = hint.value;
			}
			expect(cells).toEqual(solutionCells);
			expect(findConflicts(cells, lvl.size).size).toBe(0);
			expect(isSolvedGrid(cells, lvl.size)).toBe(true);
			expect(getHintCell(cells, lvl)).toBeNull();
		}
	});

	test("corrects a deliberately wrong cell with the solution value", () => {
		const lvl = LEVELS[0];
		const cells: SunMoonCell[] = parseRows(lvl.solution);
		const wrongIdx = 5;
		cells[wrongIdx] = cells[wrongIdx] === "S" ? "M" : "S";
		const hint = getHintCell(cells, lvl);
		expect(hint).not.toBeNull();
		expect(hint?.index).toBe(wrongIdx);
		expect(hint?.value).toBe(parseRows(lvl.solution)[wrongIdx]);
	});

	test("returns null on the solved grid", () => {
		for (const lvl of LEVELS) {
			expect(getHintCell(parseRows(lvl.solution), lvl)).toBeNull();
		}
	});
});
