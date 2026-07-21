import { achievements, type AchievementState } from "@/data/achievements";
import { en } from "@/i18n/locales/en";

const enKeys = new Set(Object.keys(en));

const emptyState: AchievementState = {
	gameProgress: {},
	articlesRead: [],
	totalFlights: 0,
	totalRelaxSessions: 0,
	soundsPlayed: [],
	streakDays: 0,
};

describe("achievements integrity", () => {
	test("every achievement has a unique id", () => {
		const ids = achievements.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test.each(achievements.map((a) => [a.id, a] as const))(
		"%s has existing translation keys and a runnable condition",
		(_id, a) => {
			expect(enKeys.has(a.titleKey)).toBe(true);
			expect(enKeys.has(a.descriptionKey)).toBe(true);
			expect(typeof a.condition).toBe("function");
			// Must not throw on an empty state and must return a boolean.
			expect(typeof a.condition(emptyState)).toBe("boolean");
		},
	);

	test("no achievement unlocks on a brand-new empty profile", () => {
		const unlocked = achievements.filter((a) => a.condition(emptyState));
		expect(unlocked).toEqual([]);
	});

	test("first-game unlocks once any game has been played", () => {
		const first = achievements.find((a) => a.id === "first-game");
		expect(first).toBeDefined();
		const state: AchievementState = {
			...emptyState,
			gameProgress: {
				memory: {
					gameId: "memory",
					lastPlayed: 1,
					highScore: 10,
					lastScore: 10,
					timesPlayed: 1,
					currentStreak: 1,
					bestStreak: 1,
					levelStars: {},
				},
			},
		};
		expect(first?.condition(state)).toBe(true);
	});
});
