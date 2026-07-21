import { pickFlightGames } from "@/utils/flightRecommendations";
import type { GameDefinition } from "@/data/games";

function game(over: Partial<GameDefinition>): GameDefinition {
	return {
		id: "g",
		titleKey: "gameMemoryName",
		descriptionKey: "gameMemoryListDescription",
		rulesKey: "rulesMemory",
		estimatedTime: 5,
		icon: "grid-outline",
		category: "brain",
		difficulty: "medium",
		loadComponent: () => (() => null) as never,
		...over,
	};
}

// Each game sits unambiguously in one time bucket (short ≤3, mid 4-6, long ≥7)
// to keep bucket assertions clean.
const fixture: GameDefinition[] = [
	game({ id: "quick-a", estimatedTime: 2, category: "reflex" }),
	game({ id: "quick-b", estimatedTime: 3, category: "brain" }),
	game({ id: "mid-a", estimatedTime: 5, category: "brain" }),
	game({ id: "mid-b", estimatedTime: 6, category: "strategy" }),
	game({ id: "deep-a", estimatedTime: 8, category: "strategy", difficulty: "hard" }),
	game({ id: "deep-b", estimatedTime: 10, category: "brain" }),
	game({ id: "together", estimatedTime: 2, isPlayTogether: true }),
];

describe("pickFlightGames", () => {
	test("short flight (≤15 min) picks only quick games", () => {
		const ids = pickFlightGames(10, [], fixture).map((g) => g.id).sort();
		expect(ids).toEqual(["quick-a", "quick-b"]);
	});

	test("medium flight picks mid-length games", () => {
		const ids = pickFlightGames(60, [], fixture).map((g) => g.id).sort();
		expect(ids).toEqual(["mid-a", "mid-b"]);
	});

	test("long haul picks deep games", () => {
		const ids = pickFlightGames(300, [], fixture).map((g) => g.id).sort();
		expect(ids).toEqual(["deep-a", "deep-b"]);
	});

	test("a hard game counts as long-haul even with a mid-length time", () => {
		const reg = [game({ id: "hard-mid", estimatedTime: 5, difficulty: "hard" })];
		expect(pickFlightGames(300, [], reg).map((g) => g.id)).toEqual(["hard-mid"]);
		// (it also legitimately appears in the mid bucket by time)
		expect(pickFlightGames(60, [], reg).map((g) => g.id)).toEqual(["hard-mid"]);
	});

	test("never recommends play-together games", () => {
		for (const mins of [5, 60, 300]) {
			const ids = pickFlightGames(mins, [], fixture).map((g) => g.id);
			expect(ids).not.toContain("together");
		}
	});

	test("preferred categories are surfaced first within a bucket", () => {
		// Short bucket has quick-a (reflex) and quick-b (brain); preferring brain
		// puts quick-b first.
		const ids = pickFlightGames(10, ["brain"], fixture).map((g) => g.id);
		expect(ids[0]).toBe("quick-b");
	});

	test("respects the limit", () => {
		const many = Array.from({ length: 10 }, (_, i) =>
			game({ id: `q${i}`, estimatedTime: 2 }),
		);
		expect(pickFlightGames(5, [], many, 4)).toHaveLength(4);
	});

	test("real registry: short flight returns solo, quick games only", () => {
		const picks = pickFlightGames(10, []); // uses real gameRegistry
		expect(picks.length).toBeGreaterThan(0);
		for (const g of picks) {
			expect(g.isPlayTogether).toBeFalsy();
			expect(g.estimatedTime).toBeLessThanOrEqual(3);
		}
	});
});
