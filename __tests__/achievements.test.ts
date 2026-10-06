import { type AchievementState, achievements } from "@/data/achievements";
import { en } from "@/i18n/locales/en";

const enKeys = new Set(Object.keys(en));

const emptyState: AchievementState = {
  articlesRead: [],
  checklistsCompleted: 0,
  converterUses: 0,
  gameProgress: {},
  maxTimezoneShiftHours: 0,
  phraseLanguagesViewed: [],
  soundsPlayed: [],
  streakDays: 0,
  totalFlights: 0,
  totalRelaxSessions: 0,
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
    }
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
          bestStreak: 1,
          currentStreak: 1,
          gameId: "memory",
          highScore: 10,
          lastPlayed: 1,
          lastScore: 10,
          levelStars: {},
          timesPlayed: 1,
        },
      },
    };
    expect(first?.condition(state)).toBe(true);
  });
});
