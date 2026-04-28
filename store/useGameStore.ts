import type { GameProgress } from "@/types/game";
import { captureAnalyticsEvent } from "@/utils/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type GameState = {
	progress: Record<string, GameProgress>;
	updateProgress: (gameId: string, score: number) => void;
};

export const useGameStore = create<GameState>()(
	persist(
		(set) => ({
			progress: {},
			updateProgress: (gameId, score) => {
				set((state) => {
					const existing = state.progress[gameId];
					return {
						progress: {
							...state.progress,
							[gameId]: {
								gameId,
								lastPlayed: Date.now(),
								highScore: Math.max(score, existing?.highScore ?? 0),
								timesPlayed: (existing?.timesPlayed ?? 0) + 1,
							},
						},
					};
				});
				captureAnalyticsEvent("game_finish", { game_id: gameId, score });
				const { useAchievementStore } = require("@/store/useAchievementStore");
				useAchievementStore.getState().checkAndUnlock();
			},
		}),
		{
			name: "game_progress",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
