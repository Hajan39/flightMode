jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: async () => undefined,
  documentDirectory: "file:///var/containers/NEW/Documents/",
}));

import { achievements } from "@/data/achievements";
import { computeProfileStats } from "@/hooks/useProfileStats";
import { fillMissingHomeOffset, useFlightStore } from "@/store/useFlightStore";
import {
  cachedImageUri,
  imageFileName,
  migrateImageCache,
  useImageCacheStore,
} from "@/store/useImageCacheStore";
import type { Flight } from "@/types/flight";
import type { GameProgress } from "@/types/game";
import { getDeviceOffsetMinutes } from "@/utils/timezone";

describe("image cache stores file names, not container paths", () => {
  test("v0 → v1 migration strips absolute URIs to the file name", () => {
    const migrated = migrateImageCache(
      {
        cache: {
          "https://a/1.png":
            "file:///var/containers/OLD/Documents/article_images/abc.png",
          "https://a/2": "file:///data/user/0/app/files/article_images/def",
          "https://a/bad": 42,
        },
      },
      0
    );
    expect(migrated.cache).toEqual({
      "https://a/1.png": "abc.png",
      "https://a/2": "def",
    });
    expect(useImageCacheStore.persist.getOptions().version).toBe(1);
  });

  test("the persist options run that migration", () => {
    const { migrate } = useImageCacheStore.persist.getOptions();
    expect(
      migrate?.({ cache: { u: "file:///x/article_images/z.webp" } }, 0)
    ).toEqual({ cache: { u: "z.webp" } });
  });

  test("setCached keeps only the file name; reads rebuild it for this container", () => {
    useImageCacheStore
      .getState()
      .setCached(
        "https://a/1.png",
        "file:///var/containers/NEW/Documents/article_images/abc.png"
      );
    const name = useImageCacheStore.getState().cache["https://a/1.png"];
    expect(name).toBe("abc.png");
    expect(cachedImageUri(name)).toBe(
      "file:///var/containers/NEW/Documents/article_images/abc.png"
    );
    // Defensive: a leftover absolute value resolves into the current container too.
    expect(cachedImageUri("file:///OLD/article_images/q.png")).toBe(
      "file:///var/containers/NEW/Documents/article_images/q.png"
    );
    expect(imageFileName("abc.png")).toBe("abc.png");
  });
});

describe("flights saved before homeOffsetMinutes", () => {
  const NOW = Date.UTC(2026, 9, 26, 12, 0);
  const base: Flight = {
    departureTime: NOW + 86_400_000,
    duration: 120,
    id: "f",
  };

  test("an upcoming flight without the field gets the device offset", () => {
    expect(fillMissingHomeOffset(base, NOW)?.homeOffsetMinutes).toBe(
      getDeviceOffsetMinutes(base.departureTime)
    );
  });

  test("explicit offsets, past flights and no flight stay untouched", () => {
    const explicit = { ...base, homeOffsetMinutes: 330 };
    expect(fillMissingHomeOffset(explicit, NOW)).toBe(explicit);
    const past = { ...base, departureTime: NOW - 60_000 };
    expect(fillMissingHomeOffset(past, NOW)).toBe(past);
    expect(fillMissingHomeOffset(null, NOW)).toBeNull();
  });

  test("hydration applies the fill-up through the store's merge", () => {
    const { merge } = useFlightStore.persist.getOptions();
    const future = { ...base, departureTime: Date.now() + 86_400_000 };
    const merged = merge?.(
      { flight: future, log: [] },
      useFlightStore.getState()
    );
    expect(merged?.flight?.homeOffsetMinutes).toBe(
      getDeviceOffsetMinutes(future.departureTime)
    );
  });
});

describe("profile stats ignore removed games and achievements", () => {
  const progress = (gameId: string, timesPlayed: number): GameProgress => ({
    bestStreak: 0,
    currentStreak: 0,
    gameId,
    highScore: 10,
    lastPlayed: 0,
    lastScore: 0,
    levelStars: {},
    timesPlayed,
  });

  test("no '58/57': unknown and duplicate unlock ids are not counted", () => {
    const all = achievements.map((a) => a.id);
    const stats = computeProfileStats({
      articlesRead: [],
      progress: {},
      streakDays: 0,
      totalFlights: 0,
      totalRelaxSessions: 0,
      unlockedIds: [...all, "tap-champion", all[0]],
    });
    expect(stats.achievementsUnlocked).toBe(achievements.length);
    expect(stats.achievementsTotal).toBe(achievements.length);
  });

  test("a removed game (tap-rush) does not count as played or favourite", () => {
    const stats = computeProfileStats({
      articlesRead: [],
      progress: {
        memory: progress("memory", 2),
        "tap-rush": progress("tap-rush", 50),
      },
      streakDays: 0,
      totalFlights: 0,
      totalRelaxSessions: 0,
      unlockedIds: [],
    });
    expect(stats.totalGamesPlayed).toBe(2);
    expect(stats.uniqueGamesPlayed).toBe(1);
    expect(stats.favoriteGameId).toBe("memory");
    expect(stats.topScores.map((s) => s.gameId)).toEqual(["memory"]);
  });
});
