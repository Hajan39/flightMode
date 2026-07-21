import { buildPuzzle, lineBetween, readCells } from "@/games/word-search/logic";

// Deterministic PRNG so buildPuzzle is reproducible in tests.
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

describe("word-search lineBetween (size 8)", () => {
	const S = 8;
	test("horizontal forward", () => {
		expect(lineBetween(0, 3, S)).toEqual([0, 1, 2, 3]);
	});
	test("horizontal reverse", () => {
		expect(lineBetween(3, 0, S)).toEqual([3, 2, 1, 0]);
	});
	test("vertical", () => {
		expect(lineBetween(0, 16, S)).toEqual([0, 8, 16]);
	});
	test("diagonal down-right", () => {
		expect(lineBetween(0, 18, S)).toEqual([0, 9, 18]);
	});
	test("single cell", () => {
		expect(lineBetween(5, 5, S)).toEqual([5]);
	});
	test("non-straight (knight move) is null", () => {
		expect(lineBetween(0, 10, S)).toBeNull();
	});
	test("horizontal line must not wrap across rows", () => {
		// 7 → 8 would wrap from row 0 to row 1; not a valid straight line.
		expect(lineBetween(7, 8, S)).toBeNull();
	});
});

describe("word-search buildPuzzle", () => {
	const WORDS = ["PILOT", "CABIN", "CARGO", "RADAR", "TOWER", "ROUTE"];
	const SIZE = 8;

	test("produces a full grid of single uppercase letters", () => {
		const puzzle = buildPuzzle(WORDS, SIZE, mulberry32(12345));
		expect(puzzle.size).toBe(SIZE);
		expect(puzzle.grid).toHaveLength(SIZE * SIZE);
		for (const cell of puzzle.grid) {
			expect(cell).toMatch(/^[A-Z]$/);
		}
	});

	test("every placement is actually readable along its cells", () => {
		// Try several seeds to exercise different placements.
		for (const seed of [1, 2, 42, 999, 2026]) {
			const puzzle = buildPuzzle(WORDS, SIZE, mulberry32(seed));
			expect(puzzle.placements.length).toBeGreaterThan(0);
			for (const p of puzzle.placements) {
				expect(readCells(puzzle.grid, p.cells)).toBe(p.word);
				// cells are in-bounds and match the word length
				expect(p.cells).toHaveLength(p.word.length);
				for (const c of p.cells) {
					expect(c).toBeGreaterThanOrEqual(0);
					expect(c).toBeLessThan(SIZE * SIZE);
				}
			}
		}
	});

	test("placed words are a subset of the requested words", () => {
		const puzzle = buildPuzzle(WORDS, SIZE, mulberry32(7));
		for (const p of puzzle.placements) {
			expect(WORDS).toContain(p.word);
		}
	});
});
