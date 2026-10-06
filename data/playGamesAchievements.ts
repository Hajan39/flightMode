/**
 * Maps FlightMode's local achievement ids (see `data/achievements.ts`) to the
 * Google Play Games Services achievement ids that Play Console generates for you.
 *
 * HOW TO FILL THIS IN
 * ───────────────────
 * 1. Play Console → your app → Play Games Services → Setup and management →
 *    Achievements. Create one achievement per row below (same wording as our
 *    i18n titles/descriptions is nice but not required).
 * 2. Each achievement gets a Play id that looks like `CgkI...`. Paste it as the
 *    value for the matching local id.
 * 3. Leave a value as `null` (or omit the row) and that achievement simply
 *    won't be pushed to Play Games — the local unlock still works. This lets
 *    you roll PGS out incrementally instead of all-or-nothing.
 *
 * The keys MUST stay in sync with the `id` fields in `data/achievements.ts`.
 * `__tests__/playGamesAchievements.test.ts` fails the build if they drift.
 */

export const playGamesAchievementIds: Record<string, string | null> = {
  "air-boss": null,
  // ── Traveler ──
  bookworm: null,
  "cargo-captain": null,
  // ── Travel tools ──
  "checklist-ready": null,
  "checklist-veteran": null,
  "crowd-favorite": null,
  "currency-savvy": null,
  // ── Relax ──
  "deep-breath": null,
  equilibrium: null,
  explorer: null,
  // ── Player ──
  "first-game": null,
  "frequent-flyer": null,
  "game-explorer": null,
  "game-master": null,
  globetrotter: null,
  "good-host": null,
  // ── Logic games ──
  "ground-controller": null,
  "high-scorer": null,
  icebreaker: null,
  // ── Multiplayer ──
  "in-sync": null,
  "know-it-all": null,
  marathon: null,
  "perfect-landing": null,
  "pixel-artist": null,
  polyglot: null,
  "puzzle-slider": null,
  "quick-thinker": null,
  // ── Quiz ──
  "quiz-ace": null,
  scholar: null,
  "sky-commander": null,
  "sky-guardian": null,
  "snake-charmer": null,
  soundscaper: null,
  // ── Special ──
  "speed-demon": null,
  "split-second": null,
  "steady-hands": null,
  storyteller: null,
  "streak-3": null,
  "streak-7": null,
  "sudoku-master": null,
  "sudoku-novice": null,
  "time-traveler": null,
  "tower-operator": null,
  "undefeated-host": null,
  "word-hunter": null,
  "word-master": null,
  "word-solver": null,
  "zen-master": null,
};

/** Returns the Play Games achievement id for a local id, or null if unmapped. */
export function getPlayGamesAchievementId(localId: string): string | null {
  // Own-property check so ids like "constructor" can't hit Object.prototype.
  if (!Object.hasOwn(playGamesAchievementIds, localId)) {
    return null;
  }
  return playGamesAchievementIds[localId] ?? null;
}
