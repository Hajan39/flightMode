import type { TranslationKey } from "@/i18n/translations";
import type { GameProgress } from "@/types/game";
import { MULTIPLAYER_GAME_IDS } from "@/utils/multiplayerScoring";

export interface AchievementState {
  articlesRead: string[];
  checklistsCompleted: number;
  converterUses: number;
  gameProgress: Record<string, GameProgress>;
  maxTimezoneShiftHours: number;
  phraseLanguagesViewed: string[];
  soundsPlayed: string[];
  streakDays: number;
  totalFlights: number;
  totalRelaxSessions: number;
}

export interface AchievementDef {
  category: "player" | "quiz" | "relax" | "traveler" | "streak" | "special";
  condition: (state: AchievementState) => boolean;
  descriptionKey: TranslationKey;
  icon: string;
  id: string;
  titleKey: TranslationKey;
}

function totalGamesPlayed(progress: Record<string, GameProgress>): number {
  return Object.values(progress).reduce((sum, g) => sum + g.timesPlayed, 0);
}

function uniqueGamesPlayed(progress: Record<string, GameProgress>): number {
  return Object.values(progress).filter((g) => g.timesPlayed > 0).length;
}

export const achievements: AchievementDef[] = [
  // ── Player ──
  {
    category: "player",
    condition: (s) => totalGamesPlayed(s.gameProgress) >= 1,
    descriptionKey: "achieveFirstGameDesc",
    icon: "game-controller-outline",
    id: "first-game",
    titleKey: "achieveFirstGameTitle",
  },
  {
    category: "player",
    condition: (s) => uniqueGamesPlayed(s.gameProgress) >= 5,
    descriptionKey: "achieveGameExplorerDesc",
    icon: "compass-outline",
    id: "game-explorer",
    titleKey: "achieveGameExplorerTitle",
  },
  {
    category: "player",
    condition: (s) => uniqueGamesPlayed(s.gameProgress) >= 13,
    descriptionKey: "achieveGameMasterDesc",
    icon: "trophy-outline",
    id: "game-master",
    titleKey: "achieveGameMasterTitle",
  },
  {
    category: "player",
    condition: (s) => totalGamesPlayed(s.gameProgress) >= 50,
    descriptionKey: "achieveMarathonDesc",
    icon: "ribbon-outline",
    id: "marathon",
    titleKey: "achieveMarathonTitle",
  },
  {
    category: "player",
    condition: (s) => {
      const entries = Object.values(s.gameProgress);
      return entries.length >= 13 && entries.every((g) => g.highScore > 0);
    },
    descriptionKey: "achieveHighScorerDesc",
    icon: "star-outline",
    id: "high-scorer",
    titleKey: "achieveHighScorerTitle",
  },
  // ── Quiz ──
  {
    category: "quiz",
    condition: (s) => (s.gameProgress.quiz?.highScore ?? 0) >= 100,
    descriptionKey: "achieveQuizAceDesc",
    icon: "school-outline",
    id: "quiz-ace",
    titleKey: "achieveQuizAceTitle",
  },
  {
    category: "quiz",
    condition: (s) => (s.gameProgress.quiz?.timesPlayed ?? 0) >= 5,
    descriptionKey: "achieveKnowItAllDesc",
    icon: "bulb-outline",
    id: "know-it-all",
    titleKey: "achieveKnowItAllTitle",
  },
  {
    category: "quiz",
    condition: (s) => (s.gameProgress.quiz?.timesPlayed ?? 0) >= 20,
    descriptionKey: "achieveScholarDesc",
    icon: "library-outline",
    id: "scholar",
    titleKey: "achieveScholarTitle",
  },
  // ── Relax ──
  {
    category: "relax",
    condition: (s) => s.totalRelaxSessions >= 1,
    descriptionKey: "achieveDeepBreathDesc",
    icon: "leaf-outline",
    id: "deep-breath",
    titleKey: "achieveDeepBreathTitle",
  },
  {
    category: "relax",
    condition: (s) => s.totalRelaxSessions >= 5,
    descriptionKey: "achieveZenMasterDesc",
    icon: "flower-outline",
    id: "zen-master",
    titleKey: "achieveZenMasterTitle",
  },
  {
    category: "relax",
    condition: (s) => s.soundsPlayed.length >= 4,
    descriptionKey: "achieveSoundscaperDesc",
    icon: "musical-notes-outline",
    id: "soundscaper",
    titleKey: "achieveSoundscaperTitle",
  },
  // ── Traveler ──
  {
    category: "traveler",
    condition: (s) => s.articlesRead.length >= 3,
    descriptionKey: "achieveBookwormDesc",
    icon: "book-outline",
    id: "bookworm",
    titleKey: "achieveBookwormTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.articlesRead.length >= 8,
    descriptionKey: "achieveExplorerDesc",
    icon: "earth-outline",
    id: "explorer",
    titleKey: "achieveExplorerTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.totalFlights >= 3,
    descriptionKey: "achieveFrequentFlyerDesc",
    icon: "airplane-outline",
    id: "frequent-flyer",
    titleKey: "achieveFrequentFlyerTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.totalFlights >= 10,
    descriptionKey: "achieveGlobetrotterDesc",
    icon: "globe-outline",
    id: "globetrotter",
    titleKey: "achieveGlobetrotterTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.checklistsCompleted >= 1,
    descriptionKey: "achieveChecklistReadyDesc",
    icon: "checkbox-outline",
    id: "checklist-ready",
    titleKey: "achieveChecklistReadyTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.checklistsCompleted >= 3,
    descriptionKey: "achieveChecklistVeteranDesc",
    icon: "checkmark-done-outline",
    id: "checklist-veteran",
    titleKey: "achieveChecklistVeteranTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.maxTimezoneShiftHours >= 6,
    descriptionKey: "achieveTimeTravelerDesc",
    icon: "time-outline",
    id: "time-traveler",
    titleKey: "achieveTimeTravelerTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.phraseLanguagesViewed.length >= 3,
    descriptionKey: "achievePolyglotDesc",
    icon: "language-outline",
    id: "polyglot",
    titleKey: "achievePolyglotTitle",
  },
  {
    category: "traveler",
    condition: (s) => s.converterUses >= 1,
    descriptionKey: "achieveCurrencySavvyDesc",
    icon: "cash-outline",
    id: "currency-savvy",
    titleKey: "achieveCurrencySavvyTitle",
  },
  // ── Return / loyalty (per-flight, not daily — this is a bursty app) ──
  {
    category: "traveler",
    // The key retention moment: did the user come back for another flight?
    condition: (s) => s.totalFlights >= 2,
    descriptionKey: "achieveStreak3Desc",
    icon: "repeat-outline",
    id: "streak-3",
    titleKey: "achieveStreak3Title",
  },
  {
    category: "traveler",
    condition: (s) => s.totalFlights >= 5,
    descriptionKey: "achieveStreak7Desc",
    icon: "medal-outline",
    id: "streak-7",
    titleKey: "achieveStreak7Title",
  },
  // ── Special ──
  {
    category: "special",
    condition: (s) => {
      const best = s.gameProgress.reaction?.highScore ?? 0;
      return best >= 800; // score = 1000 - ms, so 800 = 200ms reaction
    },
    descriptionKey: "achieveSpeedDemonDesc",
    icon: "flash-outline",
    id: "speed-demon",
    titleKey: "achieveSpeedDemonTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["runway-landing"]?.highScore ?? 0) >= 500,
    descriptionKey: "achievePerfectLandingDesc",
    icon: "checkmark-circle-outline",
    id: "perfect-landing",
    titleKey: "achievePerfectLandingTitle",
  },
  // ── Sky Defense ──
  {
    category: "special",
    condition: (s) => (s.gameProgress["sky-defense"]?.highScore ?? 0) >= 100,
    descriptionKey: "achieveSkyGuardianDesc",
    icon: "shield-outline",
    id: "sky-guardian",
    titleKey: "achieveSkyGuardianTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["sky-defense"]?.highScore ?? 0) >= 500,
    descriptionKey: "achieveSkyCommanderDesc",
    icon: "shield-checkmark-outline",
    id: "sky-commander",
    titleKey: "achieveSkyCommanderTitle",
  },
  // ── Air Traffic Control ──
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress["air-traffic-control"]?.highScore ?? 0) >= 150,
    descriptionKey: "achieveTowerOperatorDesc",
    icon: "radio-outline",
    id: "tower-operator",
    titleKey: "achieveTowerOperatorTitle",
  },
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress["air-traffic-control"]?.highScore ?? 0) >= 500,
    descriptionKey: "achieveAirBossDesc",
    icon: "aperture-outline",
    id: "air-boss",
    titleKey: "achieveAirBossTitle",
  },
  // ── Word Guess ──
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress["word-guess"]?.timesPlayed ?? 0) >= 1 &&
      (s.gameProgress["word-guess"]?.highScore ?? 0) > 0,
    descriptionKey: "achieveWordSolverDesc",
    icon: "text-outline",
    id: "word-solver",
    titleKey: "achieveWordSolverTitle",
  },
  {
    category: "special",
    // score >= 700 means guessed in ≤3 attempts (1000 - (3-1)*150 = 700)
    condition: (s) => (s.gameProgress["word-guess"]?.highScore ?? 0) >= 700,
    descriptionKey: "achieveWordMasterDesc",
    icon: "ribbon-outline",
    id: "word-master",
    titleKey: "achieveWordMasterTitle",
  },
  // ── Sudoku ──
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress.sudoku?.timesPlayed ?? 0) >= 1 &&
      (s.gameProgress.sudoku?.highScore ?? 0) > 0,
    descriptionKey: "achieveSudokuNoviceDesc",
    icon: "grid-outline",
    id: "sudoku-novice",
    titleKey: "achieveSudokuNoviceTitle",
  },
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress.sudoku?.levelStars?.["hard-no-hint"] ?? 0) >= 1,
    descriptionKey: "achieveSudokuMasterDesc",
    icon: "checkmark-done-outline",
    id: "sudoku-master",
    titleKey: "achieveSudokuMasterTitle",
  },
  // ── Snake ──
  {
    category: "special",
    condition: (s) => (s.gameProgress.snake?.highScore ?? 0) >= 20,
    descriptionKey: "achieveSnakeCharmerDesc",
    icon: "arrow-forward-circle-outline",
    id: "snake-charmer",
    titleKey: "achieveSnakeCharmerTitle",
  },
  // ── Sliding Puzzle ──
  {
    category: "special",
    condition: (s) =>
      (s.gameProgress["sliding-puzzle"]?.highScore ?? 0) >= 2000,
    descriptionKey: "achievePuzzleSliderDesc",
    icon: "grid-outline",
    id: "puzzle-slider",
    titleKey: "achievePuzzleSliderTitle",
  },
  // ── Cargo Catch ──
  {
    category: "special",
    condition: (s) => (s.gameProgress["cargo-catch"]?.highScore ?? 0) >= 25,
    descriptionKey: "achieveCargoCaptainDesc",
    icon: "cube-outline",
    id: "cargo-captain",
    titleKey: "achieveCargoCaptainTitle",
  },
  // ── Word Search ──
  {
    category: "special",
    condition: (s) => (s.gameProgress["word-search"]?.highScore ?? 0) >= 1500,
    descriptionKey: "achieveWordHunterDesc",
    icon: "search-outline",
    id: "word-hunter",
    titleKey: "achieveWordHunterTitle",
  },
  // ── Multiplayer ──
  {
    category: "special",
    condition: (s) => (s.gameProgress["seat-neighbor"]?.highScore ?? 0) >= 7,
    descriptionKey: "achieveInSyncDesc",
    icon: "heart-circle-outline",
    id: "in-sync",
    titleKey: "achieveInSyncTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["seat-neighbor"]?.timesPlayed ?? 0) >= 3,
    descriptionKey: "achieveIcebreakerDesc",
    icon: "chatbubbles-outline",
    id: "icebreaker",
    titleKey: "achieveIcebreakerTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["split-duel"]?.bestStreak ?? 0) >= 3,
    descriptionKey: "achieveSplitSecondDesc",
    icon: "flash-outline",
    id: "split-second",
    titleKey: "achieveSplitSecondTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["emoji-story"]?.timesPlayed ?? 0) >= 3,
    descriptionKey: "achieveStorytellerDesc",
    icon: "book-outline",
    id: "storyteller",
    titleKey: "achieveStorytellerTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["emoji-story"]?.highScore ?? 0) >= 5,
    descriptionKey: "achieveCrowdFavoriteDesc",
    icon: "star-half-outline",
    id: "crowd-favorite",
    titleKey: "achieveCrowdFavoriteTitle",
  },
  {
    category: "special",
    condition: (s) =>
      MULTIPLAYER_GAME_IDS.reduce(
        (sum, id) => sum + (s.gameProgress[id]?.timesPlayed ?? 0),
        0
      ) >= 10,
    descriptionKey: "achieveGoodHostDesc",
    icon: "people-outline",
    id: "good-host",
    titleKey: "achieveGoodHostTitle",
  },
  {
    category: "special",
    condition: (s) =>
      MULTIPLAYER_GAME_IDS.some(
        (id) => (s.gameProgress[id]?.bestStreak ?? 0) >= 3
      ),
    descriptionKey: "achieveUndefeatedHostDesc",
    icon: "medal-outline",
    id: "undefeated-host",
    titleKey: "achieveUndefeatedHostTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["category-blitz"]?.highScore ?? 0) >= 30,
    descriptionKey: "achieveQuickThinkerDesc",
    icon: "flash-outline",
    id: "quick-thinker",
    titleKey: "achieveQuickThinkerTitle",
  },
  {
    category: "special",
    condition: (s) => (s.gameProgress["tilt-balance"]?.highScore ?? 0) >= 40,
    descriptionKey: "achieveSteadyHandsDesc",
    icon: "hand-left-outline",
    id: "steady-hands",
    titleKey: "achieveSteadyHandsTitle",
  },
  // ── Logic games (levels cleared = levelStars entries with ≥1 star) ──
  {
    category: "special",
    condition: (s) =>
      Object.values(s.gameProgress["runway-jam"]?.levelStars ?? {}).filter(
        (stars) => stars >= 1
      ).length >= 5,
    descriptionKey: "achieveGroundControllerDesc",
    icon: "move-outline",
    id: "ground-controller",
    titleKey: "achieveGroundControllerTitle",
  },
  {
    category: "special",
    condition: (s) =>
      Object.values(s.gameProgress.nonogram?.levelStars ?? {}).filter(
        (stars) => stars >= 1
      ).length >= 5,
    descriptionKey: "achievePixelArtistDesc",
    icon: "image-outline",
    id: "pixel-artist",
    titleKey: "achievePixelArtistTitle",
  },
  {
    category: "special",
    condition: (s) =>
      Object.values(s.gameProgress["sun-moon"]?.levelStars ?? {}).filter(
        (stars) => stars >= 1
      ).length >= 5,
    descriptionKey: "achieveEquilibriumDesc",
    icon: "contrast-outline",
    id: "equilibrium",
    titleKey: "achieveEquilibriumTitle",
  },
];
