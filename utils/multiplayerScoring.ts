import { useGameStore } from "@/store/useGameStore";
import type { GameProgress, GameProgressUpdate } from "@/types/game";

/**
 * Scoring convention for pass-and-play / shared-screen games.
 *
 * `updateProgress(gameId, score, { won })` is recorded ONCE per match from the
 * host's (seat 0, the device owner's) perspective:
 *   - `score` = the host's match score,
 *   - `won`   = the host is the sole winner (a draw counts as not-won).
 *
 * This keeps `highScore` ("my best match"), `currentStreak/bestStreak`
 * ("my undefeated run") and `timesPlayed` ("matches hosted") truthful, so the
 * shared GameResult stats and profile numbers mean the same thing for solo and
 * multiplayer games.
 *
 * Some of these games also have solo / cooperative paths (tilt-balance and
 * duel-hangman solo, emoji-story story-only, seat-neighbor) that call
 * `updateProgress` directly. Those share `timesPlayed` / streaks with real
 * matches, so the cross-game host achievements (Good Host, Undefeated Host)
 * read dedicated counters instead, written ONLY by `recordMatch` into the
 * game's `levelStars` (max-merged, so every key only ever grows):
 *   - `mp:hosted`   — real multi-player matches hosted,
 *   - `mp:runStart` — `mp:hosted` value when the current winning run began,
 *   - `mp:bestRun`  — longest run of consecutive sole wins.
 */

export interface Standing {
  score: number;
  /** Secondary sort key (e.g. total pips) used only to break score ties. */
  tiebreak?: number;
}

export type RankedStanding<T extends Standing> = T & {
  /** Seat index the standing belongs to. */
  index: number;
  /** 1-based rank; tied players share a rank. */
  rank: number;
};

/** Sort standings best-first; equal (score, tiebreak) pairs share a rank. */
export function rankStandings<T extends Standing>(
  standings: T[]
): RankedStanding<T>[] {
  const indexed = standings.map((s, index) => ({ ...s, index }));
  indexed.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const ta = a.tiebreak ?? 0;
    const tb = b.tiebreak ?? 0;
    if (tb !== ta) {
      return tb - ta;
    }
    return a.index - b.index;
  });
  let rank = 0;
  let prev: { score: number; tiebreak: number } | null = null;
  return indexed.map((s, position) => {
    const key = { score: s.score, tiebreak: s.tiebreak ?? 0 };
    if (!prev || prev.score !== key.score || prev.tiebreak !== key.tiebreak) {
      rank = position + 1;
      prev = key;
    }
    return { ...s, rank };
  });
}

/** Seat index of the single best player, or null when the top spot is shared. */
export function getSoleWinnerIndex(standings: Standing[]): number | null {
  if (standings.length === 0) {
    return null;
  }
  const ranked = rankStandings(standings);
  const leaders = ranked.filter((s) => s.rank === 1);
  return leaders.length === 1 ? leaders[0].index : null;
}

export interface RecordMatchOptions {
  /** Extra points added to the recorded score when the host wins. */
  bonusIfWon?: number;
  /** Seat that represents the device owner. Default 0. */
  hostIndex?: number;
}

export const HOSTED_KEY = "mp:hosted";
export const RUN_START_KEY = "mp:runStart";
export const BEST_RUN_KEY = "mp:bestRun";

/**
 * Games with a solo / cooperative path whose legacy `timesPlayed` / streaks
 * mix in non-match runs — never used to seed the host counters.
 */
export const GAMES_WITH_SOLO_PATHS: readonly string[] = [
  "duel-hangman",
  "emoji-story",
  "seat-neighbor",
  "tilt-balance",
];

/**
 * The `levelStars` patch that records one real hosted match. On the first
 * match after this counter shipped, games WITHOUT a solo path seed it from
 * their legacy stats (every play there was a real match); games with one
 * start from zero.
 */
export function hostStatsPatch(
  gameId: string,
  existing: GameProgress | undefined,
  won: boolean
): Record<string, number> {
  const stars: Partial<Record<string, number>> = existing?.levelStars ?? {};
  const seed = !GAMES_WITH_SOLO_PATHS.includes(gameId) && existing;
  const hosted = stars[HOSTED_KEY] ?? (seed ? existing.timesPlayed : 0);
  const runStart =
    stars[RUN_START_KEY] ??
    (seed ? Math.max(0, existing.timesPlayed - existing.currentStreak) : 0);
  const bestRun = stars[BEST_RUN_KEY] ?? (seed ? existing.bestStreak : 0);
  const nextHosted = hosted + 1;
  return won
    ? {
        [BEST_RUN_KEY]: Math.max(bestRun, nextHosted - runStart),
        [HOSTED_KEY]: nextHosted,
        [RUN_START_KEY]: runStart,
      }
    : {
        [BEST_RUN_KEY]: bestRun,
        [HOSTED_KEY]: nextHosted,
        [RUN_START_KEY]: nextHosted,
      };
}

/** Real multi-player matches hosted in one game (solo runs excluded). */
export function hostedMatches(progress: GameProgress | undefined): number {
  return progress?.levelStars?.[HOSTED_KEY] ?? 0;
}

/** Longest run of consecutive sole wins in real matches of one game. */
export function bestHostRun(progress: GameProgress | undefined): number {
  return progress?.levelStars?.[BEST_RUN_KEY] ?? 0;
}

/** Persist one finished match using the host convention above. */
export function recordMatch(
  gameId: string,
  standings: Standing[],
  opts: RecordMatchOptions = {}
): GameProgressUpdate {
  const hostIndex = opts.hostIndex ?? 0;
  const winner = getSoleWinnerIndex(standings);
  const won = winner === hostIndex;
  const hostScore = Math.max(0, Math.round(standings[hostIndex]?.score ?? 0));
  const score = hostScore + (won ? (opts.bonusIfWon ?? 0) : 0);
  const store = useGameStore.getState();
  return store.updateProgress(gameId, score, {
    levelStarsPatch: hostStatsPatch(gameId, store.progress[gameId], won),
    won,
  });
}

/** Every game recorded through `recordMatch` (some also have solo paths) — used by cross-game achievements. */
export const MULTIPLAYER_GAME_IDS = [
  "duel-tictactoe",
  "duel-dice",
  "duel-connect4",
  "duel-emoji-find",
  "duel-hangman",
  "cross-air-radar",
  "cross-code-breaker",
  "cross-liars-dice",
  "split-duel",
  "seat-neighbor",
  "emoji-story",
  "category-blitz",
  "tilt-balance",
] as const;
