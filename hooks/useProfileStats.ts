import { useMemo } from "react";
import { useGameStore } from "@/store/useGameStore";
import { useAchievementStore } from "@/store/useAchievementStore";
import { achievements } from "@/data/achievements";

const GAME_ESTIMATED_MINUTES: Record<string, number> = {
	memory: 10,
	"tap-rush": 2,
	"sky-math": 3,
	quiz: 4,
	reaction: 1,
	"runway-landing": 2,
	"cabin-call": 3,
	"air-traffic-control": 12,
	"flight-path": 8,
	"sky-defense": 10,
	"stack-sort": 5,
	"duel-tictactoe": 4,
	"duel-dice": 3,
};

export type ProfileStats = {
	totalGamesPlayed: number;
	uniqueGamesPlayed: number;
	estimatedMinutes: number;
	favoriteGameId: string | null;
	streakDays: number;
	totalFlights: number;
	articlesRead: number;
	totalRelaxSessions: number;
	achievementsUnlocked: number;
	achievementsTotal: number;
	topScores: { gameId: string; highScore: number }[];
};

export function useProfileStats(): ProfileStats {
	const progress = useGameStore((s) => s.progress);
	const achievementState = useAchievementStore((s) => ({
		unlockedIds: s.unlockedIds,
		streakDays: s.streakDays,
		totalFlights: s.totalFlights,
		articlesRead: s.articlesRead,
		totalRelaxSessions: s.totalRelaxSessions,
	}));

	return useMemo(() => {
		const entries = Object.values(progress);
		const totalGamesPlayed = entries.reduce((sum, e) => sum + e.timesPlayed, 0);
		const uniqueGamesPlayed = entries.length;
		const estimatedMinutes = entries.reduce(
			(sum, e) => sum + e.timesPlayed * (GAME_ESTIMATED_MINUTES[e.gameId] ?? 3),
			0,
		);

		let favoriteGameId: string | null = null;
		let maxPlays = 0;
		for (const e of entries) {
			if (e.timesPlayed > maxPlays) {
				maxPlays = e.timesPlayed;
				favoriteGameId = e.gameId;
			}
		}

		const topScores = entries
			.filter((e) => e.highScore > 0)
			.sort((a, b) => b.highScore - a.highScore)
			.slice(0, 5)
			.map((e) => ({ gameId: e.gameId, highScore: e.highScore }));

		return {
			totalGamesPlayed,
			uniqueGamesPlayed,
			estimatedMinutes,
			favoriteGameId,
			streakDays: achievementState.streakDays,
			totalFlights: achievementState.totalFlights,
			articlesRead: achievementState.articlesRead.length,
			totalRelaxSessions: achievementState.totalRelaxSessions,
			achievementsUnlocked: achievementState.unlockedIds.length,
			achievementsTotal: achievements.length,
			topScores,
		};
	}, [progress, achievementState]);
}
