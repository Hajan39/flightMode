import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type AchievementState, achievements } from "@/data/achievements";
import { getPlayGamesAchievementId } from "@/data/playGamesAchievements";
import { useGameStore } from "@/store/useGameStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { nextStreakState, toLocalDateKey } from "@/utils/dates";
import { reportHydrationResult } from "@/utils/hydration";
import {
  resendUnlockedAchievements,
  setUnlockedPlayIdsSource,
  unlockPlayGamesAchievement,
} from "@/utils/playGames";

interface AchievementStoreState {
  articlesRead: string[];
  checkAndUnlock: () => void;
  checklistsCompleted: number;
  clearNewUnlocked: () => void;
  converterUses: number;
  incrementChecklistsCompleted: () => void;
  incrementConverterUses: () => void;
  incrementFlights: () => void;
  incrementRelax: () => void;
  lastActiveDate: string | null;
  /** Device UTC offset (minutes, east-positive) at the last streak update. */
  lastActiveOffsetMinutes: number | null;
  markArticleRead: (id: string) => void;
  markPhraseLanguageViewed: (code: string) => void;
  markSoundPlayed: (id: string) => void;
  maxTimezoneShiftHours: number;
  newUnlockedIds: string[];
  phraseLanguagesViewed: string[];
  recordTimezoneShift: (hours: number) => void;
  soundsPlayed: string[];
  streakDays: number;
  totalFlights: number;
  totalRelaxSessions: number;
  unlockedIds: string[];
  /**
   * Count today's app open toward the daily streak. `now` / `offsetMinutes`
   * are injectable for tests; they default to the device clock and zone.
   */
  updateStreak: (now?: Date, offsetMinutes?: number) => void;
}

export const useAchievementStore = create<AchievementStoreState>()(
  persist(
    (set, get) => ({
      articlesRead: [],

      checkAndUnlock: () => {
        const state = get();
        const gameProgress = useGameStore.getState().progress;
        const evalState: AchievementState = {
          articlesRead: state.articlesRead,
          checklistsCompleted: state.checklistsCompleted,
          converterUses: state.converterUses,
          gameProgress,
          maxTimezoneShiftHours: state.maxTimezoneShiftHours,
          phraseLanguagesViewed: state.phraseLanguagesViewed,
          soundsPlayed: state.soundsPlayed,
          streakDays: state.streakDays,
          totalFlights: state.totalFlights,
          totalRelaxSessions: state.totalRelaxSessions,
        };

        const newlyUnlocked: string[] = [];
        for (const a of achievements) {
          if (state.unlockedIds.includes(a.id)) {
            continue;
          }
          if (a.condition(evalState)) {
            newlyUnlocked.push(a.id);
          }
        }

        if (newlyUnlocked.length > 0) {
          set({
            newUnlockedIds: [...state.newUnlockedIds, ...newlyUnlocked],
            unlockedIds: [...state.unlockedIds, ...newlyUnlocked],
          });
          for (const id of newlyUnlocked) {
            captureAnalyticsEvent("achievement_unlocked", {
              achievement_id: id,
            });
            // Best-effort mirror to Google Play Games. Fire-and-forget:
            // no await, and the wrapper swallows every error so a PGS
            // hiccup can never affect the local (offline) unlock above.
            // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
            void unlockPlayGamesAchievement(getPlayGamesAchievementId(id));
          }
        }
      },
      checklistsCompleted: 0,

      clearNewUnlocked: () => set({ newUnlockedIds: [] }),
      converterUses: 0,

      incrementChecklistsCompleted: () => {
        set((s) => ({ checklistsCompleted: s.checklistsCompleted + 1 }));
        get().checkAndUnlock();
      },

      incrementConverterUses: () => {
        set((s) => ({ converterUses: s.converterUses + 1 }));
        get().checkAndUnlock();
      },

      incrementFlights: () => {
        set((s) => ({ totalFlights: s.totalFlights + 1 }));
        get().checkAndUnlock();
      },

      incrementRelax: () => {
        set((s) => ({ totalRelaxSessions: s.totalRelaxSessions + 1 }));
        get().checkAndUnlock();
      },
      lastActiveDate: null,
      lastActiveOffsetMinutes: null,

      markArticleRead: (id) => {
        const state = get();
        if (state.articlesRead.includes(id)) {
          return;
        }
        set({ articlesRead: [...state.articlesRead, id] });
        get().checkAndUnlock();
      },

      markPhraseLanguageViewed: (code) => {
        const state = get();
        if (state.phraseLanguagesViewed.includes(code)) {
          return;
        }
        set({ phraseLanguagesViewed: [...state.phraseLanguagesViewed, code] });
        get().checkAndUnlock();
      },

      markSoundPlayed: (id) => {
        const state = get();
        if (state.soundsPlayed.includes(id)) {
          return;
        }
        set({ soundsPlayed: [...state.soundsPlayed, id] });
        get().checkAndUnlock();
      },
      maxTimezoneShiftHours: 0,
      newUnlockedIds: [],
      phraseLanguagesViewed: [],

      recordTimezoneShift: (hours) => {
        const abs = Math.abs(hours);
        if (abs <= get().maxTimezoneShiftHours) {
          return;
        }
        set({ maxTimezoneShiftHours: abs });
        get().checkAndUnlock();
      },
      soundsPlayed: [],
      streakDays: 0,
      totalFlights: 0,
      totalRelaxSessions: 0,
      unlockedIds: [],

      updateStreak: (at, offsetMinutes) => {
        const state = get();
        const now = at ?? new Date();
        const offset = offsetMinutes ?? -now.getTimezoneOffset();
        const today = toLocalDateKey(now);
        if (state.lastActiveDate === today) {
          if (state.lastActiveOffsetMinutes !== offset) {
            set({ lastActiveOffsetMinutes: offset });
          }
          return;
        }
        const next = nextStreakState(state, today, offset);
        set({
          lastActiveDate: next.lastActiveDate,
          lastActiveOffsetMinutes: next.lastActiveOffsetMinutes ?? null,
          streakDays: next.streakDays,
        });
        get().checkAndUnlock();
      },
    }),
    {
      name: "achievements",
      // If Play Games signed in before local unlocks loaded, push them now.
      // A failed read is reported so hydration waiters don't stall.
      onRehydrateStorage: reportHydrationResult("achievements", () => {
        // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
        void resendUnlockedAchievements();
      }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// After a (re)successful Play Games sign-in, every local unlock is re-sent so
// achievements earned while signed out / offline still reach Play.
setUnlockedPlayIdsSource(() =>
  useAchievementStore
    .getState()
    .unlockedIds.map((id) => getPlayGamesAchievementId(id))
    .filter((playId): playId is string => Boolean(playId))
);
