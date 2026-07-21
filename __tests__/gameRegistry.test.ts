import { dailyChallengeGames, gameRegistry, getGameById } from "@/data/games";
import { en } from "@/i18n/locales/en";

const enKeys = new Set(Object.keys(en));
const CATEGORIES = ["brain", "reflex", "strategy", "multiplayer"];
const DIFFICULTIES = ["easy", "medium", "hard"];

describe("game registry integrity", () => {
	test("every game has a unique id", () => {
		const ids = gameRegistry.map((g) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test.each(gameRegistry.map((g) => [g.id, g] as const))(
		"%s has valid, existing translation keys and metadata",
		(_id, game) => {
			expect(enKeys.has(game.titleKey)).toBe(true);
			expect(enKeys.has(game.descriptionKey)).toBe(true);
			expect(enKeys.has(game.rulesKey)).toBe(true);
			expect(CATEGORIES).toContain(game.category);
			expect(DIFFICULTIES).toContain(game.difficulty);
			expect(typeof game.estimatedTime).toBe("number");
			expect(game.estimatedTime).toBeGreaterThan(0);
			expect(typeof game.loadComponent).toBe("function");
		},
	);

	test("getGameById resolves known ids and rejects unknown", () => {
		expect(getGameById(gameRegistry[0].id)?.id).toBe(gameRegistry[0].id);
		expect(getGameById("does-not-exist")).toBeUndefined();
	});

	test("daily challenge games are all flagged and non-empty", () => {
		expect(dailyChallengeGames.length).toBeGreaterThan(0);
		for (const g of dailyChallengeGames) {
			expect(g.isDailyChallenge).toBe(true);
		}
	});
});
