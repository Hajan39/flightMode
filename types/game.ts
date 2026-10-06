export interface GameProgress {
  bestStreak: number;
  /** Consecutive plays counted as "wins"; resets when a play is flagged as not-won */
  currentStreak: number;
  gameId: string;
  highScore: number;
  lastPlayed: number; // Unix timestamp (ms)
  /** Score from the most recent finished round */
  lastScore: number;
  /** Optional per-level star history for games with discrete level results. */
  levelStars?: Record<string, number>;
  timesPlayed: number;
}

/** Result returned by `updateProgress`, useful for showing "New Best" / streak in result UI */
export interface GameProgressUpdate {
  best: number;
  bestStreak: number;
  currentStreak: number;
  isNewBest: boolean;
  last: number;
  previousBest: number;
  timesPlayed: number;
}

export type GameCategory = "brain" | "reflex" | "strategy" | "multiplayer";

export type GameDifficulty = "easy" | "medium" | "hard";

export type GamePlayMode =
  | "bestOf"
  | "passAndPlay"
  | "sharedScreen"
  | "crossDevice";

export interface GameConfig {
  category: GameCategory;
  description: string;
  difficulty: GameDifficulty;
  estimatedTime: number; // minutes
  icon: string; // Ionicons icon name
  id: string;
  name: string;
  playMode?: GamePlayMode;
}
