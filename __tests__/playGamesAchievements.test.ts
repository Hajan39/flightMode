import { achievements } from "@/data/achievements";
import {
  getPlayGamesAchievementId,
  playGamesAchievementIds,
} from "@/data/playGamesAchievements";

const PLAY_ID_PREFIX = /^CgkI/;

const localIds = new Set(achievements.map((a) => a.id));
const mapIds = new Set(Object.keys(playGamesAchievementIds));

describe("Play Games achievement mapping integrity", () => {
  test("every local achievement has a mapping entry", () => {
    const missing = [...localIds].filter((id) => !mapIds.has(id));
    expect(missing).toEqual([]);
  });

  test("the map has no stale entries for removed achievements", () => {
    const stale = [...mapIds].filter((id) => !localIds.has(id));
    expect(stale).toEqual([]);
  });

  test("mapped values are either null or a non-empty CgkI-style id", () => {
    for (const [_id, playId] of Object.entries(playGamesAchievementIds)) {
      if (playId === null) {
        continue;
      }
      expect(typeof playId).toBe("string");
      expect((playId as string).length).toBeGreaterThan(0);
      // Not a hard requirement of Play, but every real id we've seen begins
      // with "CgkI" — catches accidental placeholder/typo values.
      expect(playId).toMatch(PLAY_ID_PREFIX);
    }
  });

  test("every achievement is wired to a unique Play Games id", () => {
    const values = Object.values(playGamesAchievementIds);
    expect(values.filter((v) => v === null)).toEqual([]);
    expect(new Set(values).size).toBe(values.length);
  });

  test("getPlayGamesAchievementId returns null for unknown ids", () => {
    expect(getPlayGamesAchievementId("does-not-exist")).toBeNull();
  });
});
