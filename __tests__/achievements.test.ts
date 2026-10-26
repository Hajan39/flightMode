import { type AchievementState, achievements } from "@/data/achievements";
import { gameRegistry } from "@/data/games";
import { en } from "@/i18n/locales/en";
import { getLocaleTable, supportedLanguages } from "@/i18n/translations";

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
    if (!first) {
      throw new Error("first-game achievement missing");
    }
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
    expect(first.condition(state)).toBe(true);
  });
});

describe("achievement descriptions use the locale's own game titles", () => {
  const languages = supportedLanguages
    .map((l) => l.code)
    .filter((code) => code !== "en");
  const descKeys = achievements.map((a) => a.descriptionKey);

  test.each(languages)(
    "%s never falls back to an English game title",
    (code) => {
      const table = getLocaleTable(code) as Record<string, string>;
      const leaks: string[] = [];
      for (const game of gameRegistry) {
        const enTitle = en[game.titleKey];
        // Locales that keep the English title (e.g. de "Sky Defense") are fine.
        if (table[game.titleKey] === enTitle) {
          continue;
        }
        for (const key of descKeys) {
          if (table[key]?.includes(enTitle)) {
            leaks.push(`${key}: ${table[key]}`);
          }
        }
      }
      expect(leaks).toEqual([]);
    }
  );
});
