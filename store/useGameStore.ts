import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameProgress, GameProgressUpdate } from "@/types/game";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { trackFirstSessionCompleted } from "@/utils/firstSession";

interface UpdateOptions {
  /** Merge per-level star results for games like Stack Sort. */
  levelStarsPatch?: Record<string, number>;
  /**
   * Whether this play counts toward the streak.
   * - `true` → increment streak.
   * - `false` → reset streak to 0.
   * - `undefined` → defaults to `true` when score > 0, otherwise `false`.
   */
  won?: boolean;
}

interface GameState {
  progress: Record<string, GameProgress>;
  resetGameProgress: (gameId: string) => void;
  updateProgress: (
    gameId: string,
    score: number,
    opts?: UpdateOptions
  ) => GameProgressUpdate;
}

function normalize(
  p: Partial<GameProgress> | undefined,
  gameId: string
): GameProgress {
  return {
    bestStreak: p?.bestStreak ?? 0,
    currentStreak: p?.currentStreak ?? 0,
    gameId,
    highScore: p?.highScore ?? 0,
    lastPlayed: p?.lastPlayed ?? 0,
    lastScore: p?.lastScore ?? 0,
    levelStars: p?.levelStars ?? {},
    timesPlayed: p?.timesPlayed ?? 0,
  };
}

function normalizeStackSort(progress: GameProgress): GameProgress {
  if (progress.gameId !== "stack-sort") {
    return progress;
  }

  const levelStars = { ...(progress.levelStars ?? {}) };
  const decodeScore = (score: number) => {
    if (score < 100) {
      return score;
    }
    const stars = Math.max(1, Math.min(3, Math.floor(score / 100)));
    const level = score % 100;
    if (level > 0) {
      levelStars[String(level)] = Math.max(
        levelStars[String(level)] ?? 0,
        stars
      );
    }
    return stars;
  };

  return {
    ...progress,
    highScore: decodeScore(progress.highScore),
    lastScore: decodeScore(progress.lastScore),
    levelStars,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      progress: {},
      resetGameProgress: (gameId) => {
        set((state) => {
          const { [gameId]: _removed, ...rest } = state.progress;
          return { progress: rest };
        });
      },
      updateProgress: (gameId, score, opts) => {
        const existing = normalizeStackSort(
          normalize(get().progress[gameId], gameId)
        );
        const previousBest = existing.highScore;
        const isNewBest = score > previousBest;
        const won = opts?.won ?? score > 0;
        const currentStreak = won ? existing.currentStreak + 1 : 0;
        const bestStreak = Math.max(existing.bestStreak, currentStreak);
        const levelStarsPatch = opts?.levelStarsPatch ?? {};
        const levelStars = { ...(existing.levelStars ?? {}) };
        for (const [levelKey, stars] of Object.entries(levelStarsPatch)) {
          levelStars[levelKey] = Math.max(levelStars[levelKey] ?? 0, stars);
        }

        const next: GameProgress = {
          bestStreak,
          currentStreak,
          gameId,
          highScore: Math.max(score, previousBest),
          lastPlayed: Date.now(),
          lastScore: score,
          levelStars,
          timesPlayed: existing.timesPlayed + 1,
        };

        set((state) => ({
          progress: { ...state.progress, [gameId]: next },
        }));

        captureAnalyticsEvent("game_finish", {
          game_id: gameId,
          is_new_best: isNewBest,
          score,
          streak: currentStreak,
        });
        trackFirstSessionCompleted("game");
        const { useAchievementStore } = require("@/store/useAchievementStore");
        useAchievementStore.getState().checkAndUnlock();

        return {
          best: next.highScore,
          bestStreak,
          currentStreak,
          isNewBest,
          last: score,
          previousBest,
          timesPlayed: next.timesPlayed,
        };
      },
    }),
    {
      migrate: (persisted: unknown, fromVersion) => {
        if (!persisted || typeof persisted !== "object") {
          return persisted;
        }
        const data = persisted as { progress?: Record<string, unknown> };
        if (fromVersion < 2 && data.progress) {
          const migrated: Record<string, GameProgress> = {};
          for (const [id, raw] of Object.entries(data.progress)) {
            migrated[id] = normalizeStackSort(
              normalize(raw as Partial<GameProgress>, id)
            );
          }
          return { ...data, progress: migrated };
        }
        if (fromVersion < 3 && data.progress) {
          const migrated: Record<string, GameProgress> = {};
          for (const [id, raw] of Object.entries(data.progress)) {
            migrated[id] = normalizeStackSort(
              normalize(raw as Partial<GameProgress>, id)
            );
          }
          return { ...data, progress: migrated };
        }
        return persisted;
      },
      name: "game_progress",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
    }
  )
);
