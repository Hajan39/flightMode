jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock("@/utils/playGames", () => ({
  resendUnlockedAchievements: jest.fn(() => Promise.resolve()),
  setUnlockedPlayIdsSource: jest.fn(),
  unlockPlayGamesAchievement: jest.fn(() => Promise.resolve()),
}));

import { useAchievementStore } from "@/store/useAchievementStore";
import { useGameStore } from "@/store/useGameStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { unlockPlayGamesAchievement } from "@/utils/playGames";

const mockCapture = captureAnalyticsEvent as jest.Mock;
const mockUnlockPgs = unlockPlayGamesAchievement as jest.Mock;

function reset() {
  useGameStore.setState({ progress: {} });
  useAchievementStore.setState({
    articlesRead: [],
    checklistsCompleted: 0,
    converterUses: 0,
    lastActiveDate: null,
    lastActiveOffsetMinutes: null,
    maxTimezoneShiftHours: 0,
    newUnlockedIds: [],
    phraseLanguagesViewed: [],
    soundsPlayed: [],
    streakDays: 0,
    totalFlights: 0,
    totalRelaxSessions: 0,
    unlockedIds: [],
  });
  mockCapture.mockClear();
  mockUnlockPgs.mockClear();
}

const state = () => useAchievementStore.getState();

describe("checkAndUnlock", () => {
  beforeEach(reset);

  test("nothing unlocks on an empty profile", () => {
    state().checkAndUnlock();
    expect(state().unlockedIds).toEqual([]);
    expect(mockUnlockPgs).not.toHaveBeenCalled();
  });

  test("a first game unlocks first-game once, mirrored to analytics + Play Games", () => {
    useGameStore.getState().updateProgress("memory", 10); // calls checkAndUnlock
    expect(state().unlockedIds).toEqual(["first-game"]);
    expect(state().newUnlockedIds).toEqual(["first-game"]);
    expect(mockCapture).toHaveBeenCalledWith("achievement_unlocked", {
      achievement_id: "first-game",
    });
    expect(mockUnlockPgs).toHaveBeenCalledTimes(1);

    // Already unlocked → never re-reported, even after the toast is cleared.
    state().clearNewUnlocked();
    useGameStore.getState().updateProgress("memory", 20);
    expect(state().unlockedIds).toEqual(["first-game"]);
    expect(state().newUnlockedIds).toEqual([]);
    expect(mockUnlockPgs).toHaveBeenCalledTimes(1);
  });

  test("relax sessions unlock deep-breath at 1 and zen-master at 5", () => {
    state().incrementRelax();
    expect(state().unlockedIds).toContain("deep-breath");
    expect(state().unlockedIds).not.toContain("zen-master");
    for (let i = 0; i < 4; i += 1) {
      state().incrementRelax();
    }
    expect(state().totalRelaxSessions).toBe(5);
    expect(state().unlockedIds).toContain("zen-master");
    expect(state().unlockedIds.filter((id) => id === "deep-breath")).toEqual([
      "deep-breath",
    ]);
  });
});

describe("dedupe + max trackers", () => {
  beforeEach(reset);

  test("articles, sounds and phrase languages count each id once", () => {
    state().markArticleRead("a");
    state().markArticleRead("a");
    state().markArticleRead("b");
    state().markSoundPlayed("rain");
    state().markSoundPlayed("rain");
    state().markPhraseLanguageViewed("ja");
    state().markPhraseLanguageViewed("ja");
    expect(state().articlesRead).toEqual(["a", "b"]);
    expect(state().soundsPlayed).toEqual(["rain"]);
    expect(state().phraseLanguagesViewed).toEqual(["ja"]);
  });

  test("recordTimezoneShift keeps the largest absolute shift", () => {
    state().recordTimezoneShift(-8);
    state().recordTimezoneShift(3);
    expect(state().maxTimezoneShiftHours).toBe(8);
    expect(state().unlockedIds).toContain("time-traveler");
  });
});

describe("updateStreak (local calendar days)", () => {
  beforeEach(() => {
    reset();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  test("consecutive days grow the streak, same day is a no-op, a gap resets", () => {
    jest.setSystemTime(new Date(2026, 0, 10, 9, 0));
    state().updateStreak();
    expect(state().streakDays).toBe(1);

    jest.setSystemTime(new Date(2026, 0, 10, 23, 0));
    state().updateStreak();
    expect(state().streakDays).toBe(1);

    jest.setSystemTime(new Date(2026, 0, 11, 0, 30));
    state().updateStreak();
    expect(state().streakDays).toBe(2);

    // A second open later the same day must not reset or grow a 2-day streak.
    jest.setSystemTime(new Date(2026, 0, 11, 22, 0));
    state().updateStreak();
    expect(state().streakDays).toBe(2);

    jest.setSystemTime(new Date(2026, 0, 13, 8, 0));
    state().updateStreak();
    expect(state().streakDays).toBe(1);
    expect(state().lastActiveDate).toBe("2026-01-13");
  });
});

describe("updateStreak across the date line (injected clock + offset)", () => {
  beforeEach(reset);

  test("west: landing on 'yesterday' keeps the streak; east: skipped day still counts", () => {
    useAchievementStore.setState({
      lastActiveDate: "2026-01-13",
      lastActiveOffsetMinutes: 780,
      streakDays: 4,
    });
    state().updateStreak(new Date(2026, 0, 12, 18, 0), -600);
    expect(state().streakDays).toBe(4);
    expect(state().lastActiveDate).toBe("2026-01-13");
    expect(state().lastActiveOffsetMinutes).toBe(-600);

    // The 13th in Honolulu is the same key → no change; then the 15th in Auckland.
    state().updateStreak(new Date(2026, 0, 13, 9, 0), -600);
    expect(state().streakDays).toBe(4);
    state().updateStreak(new Date(2026, 0, 15, 9, 0), 780);
    expect(state().streakDays).toBe(5);
    expect(state().lastActiveDate).toBe("2026-01-15");
  });

  test("defaults to the device clock when called without arguments", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 10, 9, 0));
    state().updateStreak();
    expect(state().lastActiveDate).toBe("2026-01-10");
    expect(state().lastActiveOffsetMinutes).toBe(
      -new Date(2026, 0, 10, 9, 0).getTimezoneOffset()
    );
    jest.useRealTimers();
  });
});
