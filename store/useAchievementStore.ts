import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { achievements, type AchievementState } from "@/data/achievements";
import { useGameStore } from "@/store/useGameStore";

type AchievementStoreState = {
	unlockedIds: string[];
	newUnlockedIds: string[];
	totalFlights: number;
	totalRelaxSessions: number;
	articlesRead: string[];
	soundsPlayed: string[];
	lastActiveDate: string | null;
	streakDays: number;
	checkAndUnlock: () => void;
	markArticleRead: (id: string) => void;
	incrementRelax: () => void;
	incrementFlights: () => void;
	markSoundPlayed: (id: string) => void;
	updateStreak: () => void;
	clearNewUnlocked: () => void;
};

function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
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
				const today = todayISO();
				const state = get();
				if (state.lastActiveDate === today) return;

				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				const yesterdayISO = yesterday.toISOString().slice(0, 10);

				const newStreak =
					state.lastActiveDate === yesterdayISO ? state.streakDays + 1 : 1;

				set({
					lastActiveDate: today,
					streakDays: newStreak,
				});
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
