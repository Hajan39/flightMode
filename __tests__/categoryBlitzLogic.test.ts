import { categoryBlitzKeys, ROUNDS_PER_PLAYER, TURN_SECONDS } from "@/data/categoryBlitzCategories";
import { buildTurns, tallyScores } from "@/games/category-blitz/logic";
import { en } from "@/i18n/locales/en";

const enKeys = new Set(Object.keys(en));

function seeded(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

describe("category bank", () => {
	test("has enough unique categories for a full 6-player match", () => {
		expect(new Set(categoryBlitzKeys).size).toBe(categoryBlitzKeys.length);
		expect(categoryBlitzKeys.length).toBeGreaterThanOrEqual(6 * ROUNDS_PER_PLAYER);
		for (const key of categoryBlitzKeys) expect(enKeys.has(key)).toBe(true);
	});

	test("turn length is a sane blitz", () => {
		expect(TURN_SECONDS).toBeGreaterThanOrEqual(15);
		expect(TURN_SECONDS).toBeLessThanOrEqual(30);
	});
});

describe("buildTurns", () => {
	test("one turn per player per round, in seat order", () => {
		const turns = buildTurns(3, 3, categoryBlitzKeys, seeded(1));
		expect(turns).toHaveLength(9);
		expect(turns.slice(0, 3).map((t) => t.player)).toEqual([0, 1, 2]);
		expect(turns[3].round).toBe(1);
		for (let player = 0; player < 3; player++) {
			expect(turns.filter((t) => t.player === player)).toHaveLength(3);
		}
	});

	test("categories never repeat inside a match", () => {
		for (let seed = 0; seed < 20; seed++) {
			const turns = buildTurns(6, 3, categoryBlitzKeys, seeded(seed));
			expect(new Set(turns.map((t) => t.category)).size).toBe(turns.length);
		}
	});

	test("survives a bank smaller than the match", () => {
		const tiny = categoryBlitzKeys.slice(0, 2);
		const turns = buildTurns(3, 2, tiny, seeded(5));
		expect(turns).toHaveLength(6);
		for (const turn of turns) expect(tiny).toContain(turn.category);
	});
});

describe("tallyScores", () => {
	test("sums per-turn counts per seat", () => {
		const turns = buildTurns(2, 2, categoryBlitzKeys, seeded(3));
		// turn order: p0, p1, p0, p1
		expect(tallyScores(turns, [5, 2, 4, 9], 2)).toEqual([9, 11]);
		expect(tallyScores(turns, [], 2)).toEqual([0, 0]);
	});
});
