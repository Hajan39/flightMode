import { checkGuess, getDayOfYear, WORD_POOL } from "@/games/word-guess/logic";

describe("word-guess checkGuess", () => {
	test("all correct for an exact match", () => {
		expect(checkGuess("PILOT", "PILOT")).toEqual([
			"correct",
			"correct",
			"correct",
			"correct",
			"correct",
		]);
	});

	test("all absent when no letters overlap", () => {
		expect(checkGuess("BXKWZ", "PILOT")).toEqual([
			"absent",
			"absent",
			"absent",
			"absent",
			"absent",
		]);
	});

	test("double letter in guess but single in target: only one is marked", () => {
		// target PILOT has one P (at 0) and one L (at 2), no A/E.
		// guess APPLE: A absent, first P present (matches P), second P absent
		// (P already consumed), L present, E absent.
		expect(checkGuess("APPLE", "PILOT")).toEqual([
			"absent",
			"present",
			"absent",
			"present",
			"absent",
		]);
	});

	test("green is consumed before yellow (repeated letter)", () => {
		// target LEVEL, guess EAGER: the E at index 3 is green; the leading E
		// then matches the remaining E as yellow; second target L stays unused.
		expect(checkGuess("EAGER", "LEVEL")).toEqual([
			"present",
			"absent",
			"absent",
			"correct",
			"absent",
		]);
	});

	test("mix of correct, present and absent", () => {
		// target CRANE, guess CANOE:
		// C green; A present (target has A at 2); N present (target N at 3);
		// O absent; E green.
		expect(checkGuess("CANOE", "CRANE")).toEqual([
			"correct",
			"present",
			"present",
			"absent",
			"correct",
		]);
	});
});

describe("word-guess WORD_POOL", () => {
	test("every word is exactly 5 uppercase A–Z letters", () => {
		for (const w of WORD_POOL) {
			expect(w).toMatch(/^[A-Z]{5}$/);
		}
	});

	test("pool is non-empty and de-duplicated", () => {
		expect(WORD_POOL.length).toBeGreaterThan(50);
		expect(new Set(WORD_POOL).size).toBe(WORD_POOL.length);
	});

	test("getDayOfYear returns a value within the year", () => {
		const d = getDayOfYear();
		expect(d).toBeGreaterThanOrEqual(0);
		expect(d).toBeLessThanOrEqual(366);
	});
});
