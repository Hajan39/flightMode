import type { ComponentType } from "react";

import type { TranslationKey } from "@/i18n/translations";
import type { GameCategory, GameDifficulty } from "@/types/game";

export type GameDefinition = {
	id: string;
	titleKey: TranslationKey;
	descriptionKey: TranslationKey;
	rulesKey: TranslationKey;
	estimatedTime: number;
	icon: string;
	category: GameCategory;
	difficulty: GameDifficulty;
	isDailyChallenge?: boolean;
	isPlayTogether?: boolean;
	loadComponent: () => ComponentType;
};

export const gameRegistry: GameDefinition[] = [
	{
		id: "memory",
		titleKey: "gameMemoryName",
		descriptionKey: "gameMemoryListDescription",
		rulesKey: "rulesMemory",
		estimatedTime: 10,
		icon: "grid-outline",
		category: "brain",
		difficulty: "easy",
		loadComponent: () => require("@/games/memory").default,
	},
	{
		id: "tap-rush",
		titleKey: "gameTapRushName",
		descriptionKey: "gameTapRushDescription",
		rulesKey: "rulesTouchdown",
		estimatedTime: 2,
		icon: "finger-print-outline",
		category: "reflex",
		difficulty: "easy",
		loadComponent: () => require("@/games/tap-rush").default,
	},
	{
		id: "sky-math",
		titleKey: "gameSkyMathName",
		descriptionKey: "gameSkyMathDescription",
		rulesKey: "rulesSkyMath",
		estimatedTime: 3,
		icon: "calculator-outline",
		category: "brain",
		difficulty: "medium",
		loadComponent: () => require("@/games/sky-math").default,
	},
	{
		id: "quiz",
		titleKey: "gameQuizName",
		descriptionKey: "gameQuizDescription",
		rulesKey: "rulesQuiz",
		estimatedTime: 4,
		icon: "help-circle-outline",
		category: "brain",
		difficulty: "medium",
		isDailyChallenge: true,
		loadComponent: () => require("@/games/quiz").default,
	},
	{
		id: "reaction",
		titleKey: "gameReactionName",
		descriptionKey: "gameReactionDescription",
		rulesKey: "rulesReaction",
		estimatedTime: 1,
		icon: "flash-outline",
		category: "reflex",
		difficulty: "easy",
		isDailyChallenge: true,
		loadComponent: () => require("@/games/reaction").default,
	},
	{
		id: "runway-landing",
		titleKey: "gameRunwayLandingName",
		descriptionKey: "gameRunwayLandingDescription",
		rulesKey: "rulesRunwayLanding",
		estimatedTime: 2,
		icon: "airplane-outline",
		category: "reflex",
		difficulty: "medium",
		isDailyChallenge: true,
		loadComponent: () => require("@/games/runway-landing").default,
	},
	{
		id: "cabin-call",
		titleKey: "gameCabinCallName",
		descriptionKey: "gameCabinCallDescription",
		rulesKey: "rulesCabinCall",
		estimatedTime: 3,
		icon: "megaphone-outline",
		category: "reflex",
		difficulty: "medium",
		isDailyChallenge: true,
		loadComponent: () => require("@/games/cabin-call").default,
	},
	{
		id: "air-traffic-control",
		titleKey: "gameAirTrafficControlName",
		descriptionKey: "gameAirTrafficControlDescription",
		rulesKey: "rulesAirTrafficControl",
		estimatedTime: 12,
		icon: "navigate-outline",
		category: "strategy",
		difficulty: "hard",
		loadComponent: () => require("@/games/air-traffic-control").default,
	},
	{
		id: "flight-path",
		titleKey: "gameFlightPathName",
		descriptionKey: "gameFlightPathDescription",
		rulesKey: "rulesFlightPath",
		estimatedTime: 8,
		icon: "map-outline",
		category: "strategy",
		difficulty: "hard",
		loadComponent: () => require("@/games/flight-path").default,
	},
	{
		id: "sky-defense",
		titleKey: "gameSkyDefenseName",
		descriptionKey: "gameSkyDefenseDescription",
		rulesKey: "rulesSkyDefense",
		estimatedTime: 10,
		icon: "shield-outline",
		category: "strategy",
		difficulty: "hard",
		loadComponent: () => require("@/games/sky-defense").default,
	},
	{
		id: "stack-sort",
		titleKey: "gameStackSortName",
		descriptionKey: "gameStackSortDescription",
		rulesKey: "rulesStackSort",
		estimatedTime: 5,
		icon: "layers-outline",
		category: "brain",
		difficulty: "medium",
		loadComponent: () => require("@/games/stack-sort").default,
	},
	{
		id: "duel-tictactoe",
		titleKey: "gameDuelTicTacToeName",
		descriptionKey: "gameDuelTicTacToeDescription",
		rulesKey: "rulesTicTacToe",
		estimatedTime: 4,
		icon: "people-outline",
		category: "multiplayer",
		difficulty: "easy",
		isPlayTogether: true,
		loadComponent: () => require("@/games/duel-tictactoe").default,
	},
	{
		id: "duel-dice",
		titleKey: "gameDuelDiceName",
		descriptionKey: "gameDuelDiceDescription",
		rulesKey: "rulesDice",
		estimatedTime: 3,
		icon: "dice-outline",
		category: "multiplayer",
		difficulty: "easy",
		isPlayTogether: true,
		loadComponent: () => require("@/games/duel-dice").default,
	},
	{
		id: "duel-connect4",
		titleKey: "gameDuelConnect4Name",
		descriptionKey: "gameDuelConnect4Description",
		rulesKey: "rulesConnect4",
		estimatedTime: 5,
		icon: "apps-outline",
		category: "multiplayer",
		difficulty: "medium",
		isPlayTogether: true,
		loadComponent: () => require("@/games/duel-connect4").default,
	},
	{
		id: "duel-emoji-find",
		titleKey: "gameDuelEmojiFindName",
		descriptionKey: "gameDuelEmojiFindDescription",
		rulesKey: "rulesEmojiFind",
		estimatedTime: 4,
		icon: "search-outline",
		category: "multiplayer",
		difficulty: "easy",
		isPlayTogether: true,
		loadComponent: () => require("@/games/duel-emoji-find").default,
	},
	{
		id: "duel-hangman",
		titleKey: "gameDuelHangmanName",
		descriptionKey: "gameDuelHangmanDescription",
		rulesKey: "rulesHangman",
		estimatedTime: 5,
		icon: "text-outline",
		category: "multiplayer",
		difficulty: "medium",
		isPlayTogether: true,
		loadComponent: () => require("@/games/duel-hangman").default,
	},
	{
		id: "cross-air-radar",
		titleKey: "gameCrossAirRadarName",
		descriptionKey: "gameCrossAirRadarDescription",
		rulesKey: "rulesAirRadar",
		estimatedTime: 10,
		icon: "radio-outline",
		category: "multiplayer",
		difficulty: "medium",
		isPlayTogether: true,
		loadComponent: () => require("@/games/cross-air-radar").default,
	},
	{
		id: "cross-code-breaker",
		titleKey: "gameCrossCodeBreakerName",
		descriptionKey: "gameCrossCodeBreakerDescription",
		rulesKey: "rulesCodeBreaker",
		estimatedTime: 8,
		icon: "lock-open-outline",
		category: "multiplayer",
		difficulty: "hard",
		isPlayTogether: true,
		loadComponent: () => require("@/games/cross-code-breaker").default,
	},
	{
		id: "cross-liars-dice",
		titleKey: "gameCrossLiarsDiceName",
		descriptionKey: "gameCrossLiarsDiceDescription",
		rulesKey: "rulesLiarsDice",
		estimatedTime: 6,
		icon: "skull-outline",
		category: "multiplayer",
		difficulty: "hard",
		isPlayTogether: true,
		loadComponent: () => require("@/games/cross-liars-dice").default,
	},
];

export const gamesById = Object.fromEntries(
	gameRegistry.map((game) => [game.id, game]),
) as Record<string, GameDefinition>;

export const dailyChallengeGames = gameRegistry.filter(
	(game) => game.isDailyChallenge,
);

export const playTogetherGames = gameRegistry.filter(
	(game) => game.isPlayTogether,
);

export function getGameById(id: string) {
	return gamesById[id];
}
