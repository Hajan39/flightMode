/**
 * Kids mode: pure decisions (route lock, parent hold, grid), the central
 * guards (analytics no-op, no progress / achievements / streak, no Play
 * Games auto sign-in, no review prompt) and settings hydration of old saves.
 */
import { Alert } from "react-native";

import {
  analyticsNetworkAllowsUpload,
  getAnalyticsUploadMode,
} from "@/utils/analytics";
import {
  catchFallProgress,
  createKidsDeck,
  extendSimonSequence,
  isSlideSolved,
  KIDS_CATCH_FALL_MS,
  KIDS_MOLE_HOLES,
  KIDS_SIMON_FLASH_MS,
  KIDS_SIMON_GAP_MS,
  KIDS_SIMON_LEAD_MS,
  makeKidsOddRound,
  nextMoleHole,
  shuffleSlideBoard,
  simonPlaybackAt,
  slideTile,
  solvedSlideBoard,
} from "@/utils/kidsGames";
import {
  decideRootRedirect,
  kidsGridColumns,
  PARENT_HOLD_MS,
  parentHoldState,
} from "@/utils/kidsMode";
import { shouldAutoSignInPlayGames } from "@/utils/playGames";
import { seeded } from "./helpers/gameHarness";

const base = {
  hydrated: true,
  isFirstLaunch: false,
  kidsMode: false,
  segment: "(tabs)" as string | undefined,
};

describe("decideRootRedirect (route lock)", () => {
  test("never redirects before settings hydrated", () => {
    expect(
      decideRootRedirect({ ...base, hydrated: false, kidsMode: true })
    ).toBeNull();
    expect(
      decideRootRedirect({ ...base, hydrated: false, isFirstLaunch: true })
    ).toBeNull();
  });

  test("kids mode keeps every route inside /kids", () => {
    for (const segment of [
      "(tabs)",
      undefined,
      "settings",
      "plus",
      "game",
      "content",
      "profile",
      "converter",
      "onboarding",
      "+not-found",
    ]) {
      expect(decideRootRedirect({ ...base, kidsMode: true, segment })).toBe(
        "/kids"
      );
    }
    expect(
      decideRootRedirect({ ...base, kidsMode: true, segment: "kids" })
    ).toBeNull();
  });

  test("kids mode wins over onboarding (the lock is the guarantee)", () => {
    expect(
      decideRootRedirect({
        ...base,
        isFirstLaunch: true,
        kidsMode: true,
        segment: "onboarding",
      })
    ).toBe("/kids");
  });

  test("kids area is unreachable while kids mode is off", () => {
    expect(decideRootRedirect({ ...base, segment: "kids" })).toBe("/");
    expect(
      decideRootRedirect({ ...base, isFirstLaunch: true, segment: "kids" })
    ).toBe("/onboarding");
  });

  test("onboarding redirect unchanged for adults", () => {
    expect(decideRootRedirect({ ...base, isFirstLaunch: true })).toBe(
      "/onboarding"
    );
    expect(
      decideRootRedirect({
        ...base,
        isFirstLaunch: true,
        segment: "onboarding",
      })
    ).toBeNull();
    expect(decideRootRedirect(base)).toBeNull();
  });
});

describe("parentHoldState (3 s press-and-hold)", () => {
  test("not pressed → empty", () => {
    expect(parentHoldState(null, 5000)).toEqual({
      done: false,
      progress: 0,
      ticks: 0,
    });
  });

  test("fills with the wall clock and ticks once per second", () => {
    expect(parentHoldState(1000, 1000)).toEqual({
      done: false,
      progress: 0,
      ticks: 0,
    });
    expect(parentHoldState(1000, 1999).ticks).toBe(0);
    expect(parentHoldState(1000, 2000).ticks).toBe(1);
    expect(parentHoldState(1000, 2500).progress).toBeCloseTo(0.5, 5);
    expect(parentHoldState(1000, 3999).done).toBe(false);
  });

  test("completes exactly at 3 s and stays clamped", () => {
    expect(PARENT_HOLD_MS).toBe(3000);
    expect(parentHoldState(0, 3000)).toEqual({
      done: true,
      progress: 1,
      ticks: 3,
    });
    expect(parentHoldState(0, 60_000)).toEqual({
      done: true,
      progress: 1,
      ticks: 3,
    });
  });

  test("a clock that went backwards never completes", () => {
    expect(parentHoldState(5000, 1000)).toEqual({
      done: false,
      progress: 0,
      ticks: 0,
    });
  });
});

test("kids grid: 2 columns on phones, 3 on tablets", () => {
  expect(kidsGridColumns(360)).toBe(2);
  expect(kidsGridColumns(599)).toBe(2);
  expect(kidsGridColumns(600)).toBe(3);
  expect(kidsGridColumns(1280)).toBe(3);
});

describe("kids game logic", () => {
  test("memory deck: pairs of animals", () => {
    const deck = createKidsDeck(3, seeded(1));
    expect(deck).toHaveLength(6);
    const counts = new Map<string, number>();
    for (const c of deck) {
      counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([2, 2, 2]);
  });

  test("odd one out: exactly one different picture", () => {
    const rnd = seeded(7);
    for (let round = 0; round < 5; round += 1) {
      const r = makeKidsOddRound(round, rnd);
      expect(r.items).toHaveLength(round < 3 ? 4 : 6);
      const odd = r.items[r.oddIndex];
      expect(r.items.filter((i) => i === odd)).toHaveLength(1);
      expect(new Set(r.items).size).toBe(2);
    }
  });

  test("sliding puzzle: shuffled, never solved, always solvable", () => {
    const rnd = seeded(3);
    for (let i = 0; i < 50; i += 1) {
      const board = shuffleSlideBoard(rnd);
      expect(isSlideSolved(board)).toBe(false);
      expect([...board].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      // Permutation parity (blank on the last row/col walk) → solvable.
      let inversions = 0;
      const tiles = board.filter((v) => v !== 0);
      for (let a = 0; a < tiles.length; a += 1) {
        for (let b = a + 1; b < tiles.length; b += 1) {
          if (tiles[a] > tiles[b]) {
            inversions += 1;
          }
        }
      }
      expect(inversions % 2).toBe(0);
    }
    expect(isSlideSolved(solvedSlideBoard())).toBe(true);
    expect(slideTile(solvedSlideBoard(), 0)).toBeNull();
    expect(slideTile(solvedSlideBoard(), 7)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 0, 8,
    ]);
  });

  test("simon playback is slow and clock-derived", () => {
    const seq = extendSimonSequence(
      extendSimonSequence([], seeded(2)),
      () => 0
    );
    expect(seq).toHaveLength(2);
    expect(simonPlaybackAt(seq, 0)).toEqual({ done: false, lit: null });
    expect(simonPlaybackAt(seq, KIDS_SIMON_LEAD_MS).lit).toBe(seq[0]);
    expect(
      simonPlaybackAt(seq, KIDS_SIMON_LEAD_MS + KIDS_SIMON_FLASH_MS).lit
    ).toBeNull();
    expect(
      simonPlaybackAt(
        seq,
        KIDS_SIMON_LEAD_MS + KIDS_SIMON_FLASH_MS + KIDS_SIMON_GAP_MS
      ).lit
    ).toBe(seq[1]);
    expect(simonPlaybackAt(seq, 60_000).done).toBe(true);
  });

  test("mole never repeats a hole; catch fall uses the clock", () => {
    const rnd = seeded(5);
    let prev: number | null = null;
    for (let i = 0; i < 100; i += 1) {
      const hole = nextMoleHole(prev, rnd);
      expect(hole).not.toBe(prev);
      expect(hole).toBeGreaterThanOrEqual(0);
      expect(hole).toBeLessThan(KIDS_MOLE_HOLES);
      prev = hole;
    }
    expect(catchFallProgress(1000, 1000 + KIDS_CATCH_FALL_MS / 2)).toBe(0.5);
    expect(catchFallProgress(1000, 0)).toBe(0);
  });
});

describe("analytics in kids mode", () => {
  test("upload mode holds while kids mode is on (unless opted out)", () => {
    const input = { enabled: true, hydrated: true, networkAllowsUpload: true };
    expect(getAnalyticsUploadMode(input)).toBe("send");
    expect(getAnalyticsUploadMode({ ...input, kidsMode: true })).toBe("hold");
    expect(
      getAnalyticsUploadMode({ ...input, enabled: false, kidsMode: true })
    ).toBe("disabled");
    expect(
      analyticsNetworkAllowsUpload(
        { isConnected: true, isInternetReachable: true, type: "WIFI" },
        "wifi_only"
      )
    ).toBe(true);
  });

  test("capture is a no-op: nothing sent, queued or persisted", async () => {
    let analytics: typeof import("@/utils/analytics") | undefined;
    let isolatedSettings: typeof import("@/store/useSettingsStore") | undefined;
    jest.isolateModules(() => {
      analytics = require("@/utils/analytics");
      isolatedSettings = require("@/store/useSettingsStore");
    });
    if (!(analytics && isolatedSettings)) {
      throw new Error("modules failed to load");
    }
    // The lazy settings read may resolve in either registry: drive both.
    const mainSettings = require("@/store/useSettingsStore");
    const setKids = (kidsMode: boolean) => {
      isolatedSettings?.useSettingsStore.setState({ kidsMode });
      mainSettings.useSettingsStore.setState({ kidsMode });
    };
    const stored = new Map<string, string>();
    analytics.setAnalyticsQueueStorage({
      getItem: (k) => Promise.resolve(stored.get(k) ?? null),
      removeItem: (k) => {
        stored.delete(k);
        return Promise.resolve();
      },
      setItem: (k, v) => {
        stored.set(k, v);
        return Promise.resolve();
      },
    });
    await analytics.restoreAnalyticsQueue();

    setKids(true);
    analytics.captureAnalyticsEvent("game_start", { game_id: "memory" });
    analytics.captureAnalyticsEvent("app_open");
    await analytics.flushAnalyticsQueueWrites();
    const sink = jest.fn();
    analytics.setAnalyticsSink(sink);
    expect(sink).not.toHaveBeenCalled();
    expect(stored.get(analytics.ANALYTICS_QUEUE_KEY)).toBeUndefined();
    analytics.captureAnalyticsEvent("game_finish");
    expect(sink).not.toHaveBeenCalled();

    // Back to adult use: capture works again.
    setKids(false);
    analytics.captureAnalyticsEvent("app_open");
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toBe("app_open");
  });
});

describe("stores in kids mode", () => {
  const { useGameStore } = require("@/store/useGameStore");
  const { useAchievementStore } = require("@/store/useAchievementStore");
  const { useSettingsStore } = require("@/store/useSettingsStore");

  afterEach(() => {
    useSettingsStore.setState({ kidsMode: false });
  });

  test("updateProgress records nothing (progress, achievements)", () => {
    useGameStore.setState({ progress: {} });
    useAchievementStore.setState({ newUnlockedIds: [], unlockedIds: [] });
    useSettingsStore.setState({ kidsMode: true });
    const result = useGameStore.getState().updateProgress("memory", 500);
    expect(result.isNewBest).toBe(false);
    expect(useGameStore.getState().progress).toEqual({});
    expect(useAchievementStore.getState().unlockedIds).toEqual([]);

    // Adult behaviour unchanged once kids mode is off.
    useSettingsStore.setState({ kidsMode: false });
    useGameStore.getState().updateProgress("memory", 500);
    expect(useGameStore.getState().progress.memory.highScore).toBe(500);
  });

  test("the daily streak is not counted while a child uses the app", () => {
    useAchievementStore.setState({ lastActiveDate: null, streakDays: 0 });
    useSettingsStore.setState({ kidsMode: true });
    useAchievementStore.getState().updateStreak(new Date(2026, 10, 1), 60);
    expect(useAchievementStore.getState().streakDays).toBe(0);
    useSettingsStore.setState({ kidsMode: false });
    useAchievementStore.getState().updateStreak(new Date(2026, 10, 1), 60);
    expect(useAchievementStore.getState().streakDays).toBe(1);
  });

  test("no review dialog in kids mode", () => {
    const { useNetworkStore } = require("@/store/useNetworkStore");
    const { maybeAskForReview } = require("@/utils/reviewPrompt");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {
      /* no-op */
    });
    useNetworkStore.setState({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    });
    useSettingsStore.setState({
      appOpenCount: 10,
      kidsMode: true,
      lastReviewPromptAt: null,
      reviewDone: false,
    });
    maybeAskForReview(50, (k: string) => k);
    expect(alert).not.toHaveBeenCalled();
    useSettingsStore.setState({ kidsMode: false });
    maybeAskForReview(50, (k: string) => k);
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  test("Play Games never auto signs in in kids mode", () => {
    const state = {
      isFirstLaunch: false,
      routeSegment: "kids",
      settingsHydrated: true,
    };
    expect(shouldAutoSignInPlayGames(state)).toBe(true);
    expect(shouldAutoSignInPlayGames({ ...state, kidsMode: true })).toBe(false);
  });
});

describe("settings hydration", () => {
  /** A fresh settings store + the AsyncStorage instance it uses ("app run"). */
  function freshRun() {
    let store: typeof import("@/store/useSettingsStore") | undefined;
    let storage:
      | typeof import("@react-native-async-storage/async-storage").default
      | undefined;
    jest.isolateModules(() => {
      const mod = require("@react-native-async-storage/async-storage");
      storage = mod.default ?? mod;
      store = require("@/store/useSettingsStore");
    });
    if (!(store && storage)) {
      throw new Error("settings store failed to load");
    }
    return { storage, store };
  }

  test("old saved settings (no kidsMode) hydrate with kidsMode=false", async () => {
    const { storage, store } = freshRun();
    await storage.setItem(
      "settings",
      JSON.stringify({
        state: {
          analyticsEnabled: false,
          appOpenCount: 9,
          isFirstLaunch: false,
          language: "cs",
          themeMode: "dark",
        },
        version: 0,
      })
    );
    await store.useSettingsStore.persist.rehydrate();
    const s = store.useSettingsStore.getState();
    expect(s.kidsMode).toBe(false);
    expect(s.isFirstLaunch).toBe(false);
    expect(s.language).toBe("cs");
    expect(s.appOpenCount).toBe(9);
    expect(store.isKidsModeOn()).toBe(false);
  });

  test("kidsMode=true survives a restart", async () => {
    const { storage, store } = freshRun();
    await storage.setItem(
      "settings",
      JSON.stringify({
        state: { isFirstLaunch: false, kidsMode: true },
        version: 0,
      })
    );
    await store.useSettingsStore.persist.rehydrate();
    expect(store.useSettingsStore.getState().kidsMode).toBe(true);
    expect(store.isKidsModeOn()).toBe(true);
  });
});
