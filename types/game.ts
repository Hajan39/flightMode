export type GameProgress = {
  gameId: string;
  lastPlayed: number; // Unix timestamp (ms)
  highScore: number;
  timesPlayed: number;
};

export type GameConfig = {
  id: string;
  name: string;
  description: string;
  estimatedTime: number; // minutes
  icon: string; // Ionicons icon name
};
