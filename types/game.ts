export type GameProgress = {
	gameId: string;
	lastPlayed: number; // Unix timestamp (ms)
	highScore: number;
	/** Score from the most recent finished round */
	lastScore: number;
	timesPlayed: number;
	/** Consecutive plays counted as "wins"; resets when a play is flagged as not-won */
	currentStreak: number;
	bestStreak: number;
	/** Optional per-level star history for games with discrete level results. */
	levelStars?: Record<string, number>;
};

/** Result returned by `updateProgress`, useful for showing "New Best" / streak in result UI */
export type GameProgressUpdate = {
	isNewBest: boolean;
	best: number;
	last: number;
	previousBest: number;
	currentStreak: number;
	bestStreak: number;
	timesPlayed: number;
};

export type GameCategory = "brain" | "reflex" | "strategy" | "multiplayer";

export type GameDifficulty = "easy" | "medium" | "hard";

export type GamePlayMode =
	| "bestOf"
	| "passAndPlay"
	| "sharedScreen"
	| "crossDevice";

export type GameConfig = {
	id: string;
	name: string;
	description: string;
	estimatedTime: number; // minutes
	icon: string; // Ionicons icon name
	category: GameCategory;
	difficulty: GameDifficulty;
	playMode?: GamePlayMode;
};
