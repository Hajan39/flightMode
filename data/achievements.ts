import type { TranslationKey } from "@/i18n/translations";
import type { GameProgress } from "@/types/game";

export type AchievementState = {
	gameProgress: Record<string, GameProgress>;
	articlesRead: string[];
	totalFlights: number;
	totalRelaxSessions: number;
	soundsPlayed: string[];
	streakDays: number;
};

export type AchievementDef = {
	id: string;
	titleKey: TranslationKey;
	descriptionKey: TranslationKey;
	icon: string;
	category: "player" | "quiz" | "relax" | "traveler" | "streak" | "special";
	condition: (state: AchievementState) => boolean;
};

function totalGamesPlayed(progress: Record<string, GameProgress>): number {
	return Object.values(progress).reduce((sum, g) => sum + g.timesPlayed, 0);
}

function uniqueGamesPlayed(progress: Record<string, GameProgress>): number {
	return Object.values(progress).filter((g) => g.timesPlayed > 0).length;
}

export const achievements: AchievementDef[] = [
	// ── Player ──
	{
		id: "first-game",
		titleKey: "achieveFirstGameTitle",
		descriptionKey: "achieveFirstGameDesc",
		icon: "game-controller-outline",
		category: "player",
		condition: (s) => totalGamesPlayed(s.gameProgress) >= 1,
	},
	{
		id: "game-explorer",
		titleKey: "achieveGameExplorerTitle",
		descriptionKey: "achieveGameExplorerDesc",
		icon: "compass-outline",
		category: "player",
		condition: (s) => uniqueGamesPlayed(s.gameProgress) >= 5,
	},
	{
		id: "game-master",
		titleKey: "achieveGameMasterTitle",
		descriptionKey: "achieveGameMasterDesc",
		icon: "trophy-outline",
		category: "player",
		condition: (s) => uniqueGamesPlayed(s.gameProgress) >= 13,
	},
	{
		id: "marathon",
		titleKey: "achieveMarathonTitle",
		descriptionKey: "achieveMarathonDesc",
		icon: "ribbon-outline",
		category: "player",
		condition: (s) => totalGamesPlayed(s.gameProgress) >= 50,
	},
	{
		id: "high-scorer",
		titleKey: "achieveHighScorerTitle",
		descriptionKey: "achieveHighScorerDesc",
		icon: "star-outline",
		category: "player",
		condition: (s) => {
			const entries = Object.values(s.gameProgress);
			return entries.length >= 13 && entries.every((g) => g.highScore > 0);
		},
	},
	// ── Quiz ──
	{
		id: "quiz-ace",
		titleKey: "achieveQuizAceTitle",
		descriptionKey: "achieveQuizAceDesc",
		icon: "school-outline",
		category: "quiz",
		condition: (s) => (s.gameProgress["quiz"]?.highScore ?? 0) >= 100,
	},
	{
		id: "know-it-all",
		titleKey: "achieveKnowItAllTitle",
		descriptionKey: "achieveKnowItAllDesc",
		icon: "bulb-outline",
		category: "quiz",
		condition: (s) => (s.gameProgress["quiz"]?.timesPlayed ?? 0) >= 5,
	},
	{
		id: "scholar",
		titleKey: "achieveScholarTitle",
		descriptionKey: "achieveScholarDesc",
		icon: "library-outline",
		category: "quiz",
		condition: (s) => (s.gameProgress["quiz"]?.timesPlayed ?? 0) >= 20,
	},
	// ── Relax ──
	{
		id: "deep-breath",
		titleKey: "achieveDeepBreathTitle",
		descriptionKey: "achieveDeepBreathDesc",
		icon: "leaf-outline",
		category: "relax",
		condition: (s) => s.totalRelaxSessions >= 1,
	},
	{
		id: "zen-master",
		titleKey: "achieveZenMasterTitle",
		descriptionKey: "achieveZenMasterDesc",
		icon: "flower-outline",
		category: "relax",
		condition: (s) => s.totalRelaxSessions >= 5,
	},
	{
		id: "soundscaper",
		titleKey: "achieveSoundscaperTitle",
		descriptionKey: "achieveSoundscaperDesc",
		icon: "musical-notes-outline",
		category: "relax",
		condition: (s) => s.soundsPlayed.length >= 4,
	},
	// ── Traveler ──
	{
		id: "bookworm",
		titleKey: "achieveBookwormTitle",
		descriptionKey: "achieveBookwormDesc",
		icon: "book-outline",
		category: "traveler",
		condition: (s) => s.articlesRead.length >= 3,
	},
	{
		id: "explorer",
		titleKey: "achieveExplorerTitle",
		descriptionKey: "achieveExplorerDesc",
		icon: "earth-outline",
		category: "traveler",
		condition: (s) => s.articlesRead.length >= 8,
	},
	{
		id: "frequent-flyer",
		titleKey: "achieveFrequentFlyerTitle",
		descriptionKey: "achieveFrequentFlyerDesc",
		icon: "airplane-outline",
		category: "traveler",
		condition: (s) => s.totalFlights >= 3,
	},
	{
		id: "globetrotter",
		titleKey: "achieveGlobetrotterTitle",
		descriptionKey: "achieveGlobetrotterDesc",
		icon: "globe-outline",
		category: "traveler",
		condition: (s) => s.totalFlights >= 10,
	},
	// ── Return / loyalty (per-flight, not daily — this is a bursty app) ──
	{
		id: "streak-3",
		titleKey: "achieveStreak3Title",
		descriptionKey: "achieveStreak3Desc",
		icon: "repeat-outline",
		category: "traveler",
		// The key retention moment: did the user come back for another flight?
		condition: (s) => s.totalFlights >= 2,
	},
	{
		id: "streak-7",
		titleKey: "achieveStreak7Title",
		descriptionKey: "achieveStreak7Desc",
		icon: "medal-outline",
		category: "traveler",
		condition: (s) => s.totalFlights >= 5,
	},
	// ── Special ──
	{
		id: "speed-demon",
		titleKey: "achieveSpeedDemonTitle",
		descriptionKey: "achieveSpeedDemonDesc",
		icon: "flash-outline",
		category: "special",
		condition: (s) => {
			const best = s.gameProgress["reaction"]?.highScore ?? 0;
			return best >= 800; // score = 1000 - ms, so 800 = 200ms reaction
		},
	},
	{
		id: "perfect-landing",
		titleKey: "achievePerfectLandingTitle",
		descriptionKey: "achievePerfectLandingDesc",
		icon: "checkmark-circle-outline",
		category: "special",
		condition: (s) => (s.gameProgress["runway-landing"]?.highScore ?? 0) >= 500,
	},
	// ── Sky Defense ──
	{
		id: "sky-guardian",
		titleKey: "achieveSkyGuardianTitle",
		descriptionKey: "achieveSkyGuardianDesc",
		icon: "shield-outline",
		category: "special",
		condition: (s) => (s.gameProgress["sky-defense"]?.highScore ?? 0) >= 100,
	},
	{
		id: "sky-commander",
		titleKey: "achieveSkyCommanderTitle",
		descriptionKey: "achieveSkyCommanderDesc",
		icon: "shield-checkmark-outline",
		category: "special",
		condition: (s) => (s.gameProgress["sky-defense"]?.highScore ?? 0) >= 500,
	},
	// ── Air Traffic Control ──
	{
		id: "tower-operator",
		titleKey: "achieveTowerOperatorTitle",
		descriptionKey: "achieveTowerOperatorDesc",
		icon: "radio-outline",
		category: "special",
		condition: (s) => (s.gameProgress["air-traffic-control"]?.highScore ?? 0) >= 150,
	},
	{
		id: "air-boss",
		titleKey: "achieveAirBossTitle",
		descriptionKey: "achieveAirBossDesc",
		icon: "aperture-outline",
		category: "special",
		condition: (s) => (s.gameProgress["air-traffic-control"]?.highScore ?? 0) >= 500,
	},
	// ── Word Guess ──
	{
		id: "word-solver",
		titleKey: "achieveWordSolverTitle",
		descriptionKey: "achieveWordSolverDesc",
		icon: "text-outline",
		category: "special",
		condition: (s) =>
			(s.gameProgress["word-guess"]?.timesPlayed ?? 0) >= 1 &&
			(s.gameProgress["word-guess"]?.highScore ?? 0) > 0,
	},
	{
		id: "word-master",
		titleKey: "achieveWordMasterTitle",
		descriptionKey: "achieveWordMasterDesc",
		icon: "ribbon-outline",
		category: "special",
		// score >= 700 means guessed in ≤3 attempts (1000 - (3-1)*150 = 700)
		condition: (s) => (s.gameProgress["word-guess"]?.highScore ?? 0) >= 700,
	},
	// ── Sudoku ──
	{
		id: "sudoku-novice",
		titleKey: "achieveSudokuNoviceTitle",
		descriptionKey: "achieveSudokuNoviceDesc",
		icon: "grid-outline",
		category: "special",
		condition: (s) =>
			(s.gameProgress["sudoku"]?.timesPlayed ?? 0) >= 1 &&
			(s.gameProgress["sudoku"]?.highScore ?? 0) > 0,
	},
	{
		id: "sudoku-master",
		titleKey: "achieveSudokuMasterTitle",
		descriptionKey: "achieveSudokuMasterDesc",
		icon: "checkmark-done-outline",
		category: "special",
		condition: (s) =>
			(s.gameProgress["sudoku"]?.levelStars?.["hard-no-hint"] ?? 0) >= 1,
	},
	// ── Snake ──
	{
		id: "snake-charmer",
		titleKey: "achieveSnakeCharmerTitle",
		descriptionKey: "achieveSnakeCharmerDesc",
		icon: "arrow-forward-circle-outline",
		category: "special",
		condition: (s) => (s.gameProgress["snake"]?.highScore ?? 0) >= 20,
	},
	// ── Sliding Puzzle ──
	{
		id: "puzzle-slider",
		titleKey: "achievePuzzleSliderTitle",
		descriptionKey: "achievePuzzleSliderDesc",
		icon: "grid-outline",
		category: "special",
		condition: (s) => (s.gameProgress["sliding-puzzle"]?.highScore ?? 0) >= 2000,
	},
	// ── Cargo Catch ──
	{
		id: "cargo-captain",
		titleKey: "achieveCargoCaptainTitle",
		descriptionKey: "achieveCargoCaptainDesc",
		icon: "cube-outline",
		category: "special",
		condition: (s) => (s.gameProgress["cargo-catch"]?.highScore ?? 0) >= 25,
	},
	// ── Word Search ──
	{
		id: "word-hunter",
		titleKey: "achieveWordHunterTitle",
		descriptionKey: "achieveWordHunterDesc",
		icon: "search-outline",
		category: "special",
		condition: (s) => (s.gameProgress["word-search"]?.highScore ?? 0) >= 1500,
	},
];
