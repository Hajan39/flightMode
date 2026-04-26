export type GameProgress = {
	gameId: string;
	lastPlayed: number; // Unix timestamp (ms)
	highScore: number;
	timesPlayed: number;
};

export type GameCategory = "brain" | "reflex" | "strategy" | "multiplayer";

export type GameDifficulty = "easy" | "medium" | "hard";

export type GameConfig = {
	id: string;
	name: string;
	description: string;
	estimatedTime: number; // minutes
	icon: string; // Ionicons icon name
	category: GameCategory;
	difficulty: GameDifficulty;
};
