import { achievements } from "@/data/achievements";
import { getGameById } from "@/data/games";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useGameStore } from "@/store/useGameStore";

export interface ProfileStats {
  achievementsTotal: number;
  achievementsUnlocked: number;
  articlesRead: number;
  estimatedMinutes: number;
  favoriteGameId: string | null;
  streakDays: number;
  topScores: { gameId: string; highScore: number }[];
  totalFlights: number;
  totalGamesPlayed: number;
  totalRelaxSessions: number;
  uniqueGamesPlayed: number;
}

export function useProfileStats(): ProfileStats {
  const progress = useGameStore((s) => s.progress);
  const unlockedIds = useAchievementStore((s) => s.unlockedIds);
  const streakDays = useAchievementStore((s) => s.streakDays);
  const totalFlights = useAchievementStore((s) => s.totalFlights);
  const articlesRead = useAchievementStore((s) => s.articlesRead);
  const totalRelaxSessions = useAchievementStore((s) => s.totalRelaxSessions);

  const entries = Object.values(progress);
  const totalGamesPlayed = entries.reduce((sum, e) => sum + e.timesPlayed, 0);
  const uniqueGamesPlayed = entries.length;
  const estimatedMinutes = entries.reduce(
    (sum, e) =>
      sum + e.timesPlayed * (getGameById(e.gameId)?.estimatedTime ?? 3),
    0
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
    achievementsTotal: achievements.length,
    achievementsUnlocked: unlockedIds.length,
    articlesRead: articlesRead.length,
    estimatedMinutes,
    favoriteGameId,
    streakDays,
    topScores,
    totalFlights,
    totalGamesPlayed,
    totalRelaxSessions,
    uniqueGamesPlayed,
  };
}
