import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type AchievementState, achievements } from "@/data/achievements";
import { getPlayGamesAchievementId } from "@/data/playGamesAchievements";
import { useGameStore } from "@/store/useGameStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { addDays, toLocalDateKey } from "@/utils/dates";
import { unlockPlayGamesAchievement } from "@/utils/playGames";

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
  updateStreak: () => void;
}

function todayKey(): string {
  return toLocalDateKey(new Date());
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

      updateStreak: () => {
        const today = todayKey();
        const state = get();
        if (state.lastActiveDate === today) {
          return;
        }

        const yesterdayKey = toLocalDateKey(addDays(new Date(), -1));

        const newStreak =
          state.lastActiveDate === yesterdayKey ? state.streakDays + 1 : 1;

        set({
          lastActiveDate: today,
          streakDays: newStreak,
        });
        get().checkAndUnlock();
      },
    }),
    {
      name: "achievements",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
