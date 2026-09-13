import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { achievements, type AchievementState } from "@/data/achievements";
import { getPlayGamesAchievementId } from "@/data/playGamesAchievements";
import { useGameStore } from "@/store/useGameStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { addDays, toLocalDateKey } from "@/utils/dates";
import { unlockPlayGamesAchievement } from "@/utils/playGames";

type AchievementStoreState = {
	unlockedIds: string[];
	newUnlockedIds: string[];
	totalFlights: number;
	totalRelaxSessions: number;
	articlesRead: string[];
	soundsPlayed: string[];
	lastActiveDate: string | null;
	streakDays: number;
	checklistsCompleted: number;
	maxTimezoneShiftHours: number;
	phraseLanguagesViewed: string[];
	converterUses: number;
	checkAndUnlock: () => void;
	incrementChecklistsCompleted: () => void;
	recordTimezoneShift: (hours: number) => void;
	markPhraseLanguageViewed: (code: string) => void;
	incrementConverterUses: () => void;
	markArticleRead: (id: string) => void;
	incrementRelax: () => void;
	incrementFlights: () => void;
	markSoundPlayed: (id: string) => void;
	updateStreak: () => void;
	clearNewUnlocked: () => void;
};

function todayKey(): string {
	return toLocalDateKey(new Date());
}

export const useAchievementStore = create<AchievementStoreState>()(
	persist(
		(set, get) => ({
			unlockedIds: [],
			newUnlockedIds: [],
			totalFlights: 0,
			totalRelaxSessions: 0,
			articlesRead: [],
			soundsPlayed: [],
			lastActiveDate: null,
			streakDays: 0,
			checklistsCompleted: 0,
			maxTimezoneShiftHours: 0,
			phraseLanguagesViewed: [],
			converterUses: 0,

			checkAndUnlock: () => {
				const state = get();
				const gameProgress = useGameStore.getState().progress;
				const evalState: AchievementState = {
					gameProgress,
					articlesRead: state.articlesRead,
					totalFlights: state.totalFlights,
					totalRelaxSessions: state.totalRelaxSessions,
					soundsPlayed: state.soundsPlayed,
					streakDays: state.streakDays,
					checklistsCompleted: state.checklistsCompleted,
					maxTimezoneShiftHours: state.maxTimezoneShiftHours,
					phraseLanguagesViewed: state.phraseLanguagesViewed,
					converterUses: state.converterUses,
				};

				const newlyUnlocked: string[] = [];
				for (const a of achievements) {
					if (state.unlockedIds.includes(a.id)) continue;
					if (a.condition(evalState)) {
						newlyUnlocked.push(a.id);
					}
				}

				if (newlyUnlocked.length > 0) {
					set({
						unlockedIds: [...state.unlockedIds, ...newlyUnlocked],
						newUnlockedIds: [...state.newUnlockedIds, ...newlyUnlocked],
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

			markArticleRead: (id) => {
				const state = get();
				if (state.articlesRead.includes(id)) return;
				set({ articlesRead: [...state.articlesRead, id] });
				get().checkAndUnlock();
			},

			incrementRelax: () => {
				set((s) => ({ totalRelaxSessions: s.totalRelaxSessions + 1 }));
				get().checkAndUnlock();
			},

			incrementFlights: () => {
				set((s) => ({ totalFlights: s.totalFlights + 1 }));
				get().checkAndUnlock();
			},

			markSoundPlayed: (id) => {
				const state = get();
				if (state.soundsPlayed.includes(id)) return;
				set({ soundsPlayed: [...state.soundsPlayed, id] });
				get().checkAndUnlock();
			},

			updateStreak: () => {
				const today = todayKey();
				const state = get();
				if (state.lastActiveDate === today) return;

				const yesterdayKey = toLocalDateKey(addDays(new Date(), -1));

				const newStreak =
					state.lastActiveDate === yesterdayKey ? state.streakDays + 1 : 1;

				set({
					lastActiveDate: today,
					streakDays: newStreak,
				});
				get().checkAndUnlock();
			},

			incrementChecklistsCompleted: () => {
				set((s) => ({ checklistsCompleted: s.checklistsCompleted + 1 }));
				get().checkAndUnlock();
			},

			recordTimezoneShift: (hours) => {
				const abs = Math.abs(hours);
				if (abs <= get().maxTimezoneShiftHours) return;
				set({ maxTimezoneShiftHours: abs });
				get().checkAndUnlock();
			},

			markPhraseLanguageViewed: (code) => {
				const state = get();
				if (state.phraseLanguagesViewed.includes(code)) return;
				set({ phraseLanguagesViewed: [...state.phraseLanguagesViewed, code] });
				get().checkAndUnlock();
			},

			incrementConverterUses: () => {
				set((s) => ({ converterUses: s.converterUses + 1 }));
				get().checkAndUnlock();
			},

			clearNewUnlocked: () => set({ newUnlockedIds: [] }),
		}),
		{
			name: "achievements",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
