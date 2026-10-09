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
  "air-boss": "CgkI4url5b4bEAIQNA",
  bookworm: "CgkI4url5b4bEAIQXA",
  "cargo-captain": "CgkI4url5b4bEAIQWg",
  "checklist-ready": "CgkI4url5b4bEAIQUw",
  "checklist-veteran": "CgkI4url5b4bEAIQOQ",
  "crowd-favorite": "CgkI4url5b4bEAIQRg",
  "currency-savvy": "CgkI4url5b4bEAIQSw",
  "deep-breath": "CgkI4url5b4bEAIQPA",
  equilibrium: "CgkI4url5b4bEAIQUg",
  explorer: "CgkI4url5b4bEAIQXg",
  "first-game": "CgkI4url5b4bEAIQOw",
  "frequent-flyer": "CgkI4url5b4bEAIQQw",
  "game-explorer": "CgkI4url5b4bEAIQMg",
  "game-master": "CgkI4url5b4bEAIQTQ",
  globetrotter: "CgkI4url5b4bEAIQXw",
  "good-host": "CgkI4url5b4bEAIQQA",
  "ground-controller": "CgkI4url5b4bEAIQXQ",
  "high-scorer": "CgkI4url5b4bEAIQRQ",
  icebreaker: "CgkI4url5b4bEAIQNQ",
  "in-sync": "CgkI4url5b4bEAIQVg",
  "know-it-all": "CgkI4url5b4bEAIQNw",
  marathon: "CgkI4url5b4bEAIQWw",
  "perfect-landing": "CgkI4url5b4bEAIQRw",
  "pixel-artist": "CgkI4url5b4bEAIQOg",
  polyglot: "CgkI4url5b4bEAIQTA",
  "puzzle-slider": "CgkI4url5b4bEAIQPQ",
  "quick-thinker": "CgkI4url5b4bEAIQWQ",
  "quiz-ace": "CgkI4url5b4bEAIQQQ",
  scholar: "CgkI4url5b4bEAIQMw",
  "sky-commander": "CgkI4url5b4bEAIQTg",
  "sky-guardian": "CgkI4url5b4bEAIQUA",
  "snake-charmer": "CgkI4url5b4bEAIQVw",
  soundscaper: "CgkI4url5b4bEAIQOA",
  "speed-demon": "CgkI4url5b4bEAIQNg",
  "split-second": "CgkI4url5b4bEAIQSg",
  "steady-hands": "CgkI4url5b4bEAIQYA",
  storyteller: "CgkI4url5b4bEAIQQg",
  "streak-3": "CgkI4url5b4bEAIQVA",
  "streak-7": "CgkI4url5b4bEAIQPg",
  "sudoku-master": "CgkI4url5b4bEAIQSA",
  "sudoku-novice": "CgkI4url5b4bEAIQUQ",
  "time-traveler": "CgkI4url5b4bEAIQRA",
  "tower-operator": "CgkI4url5b4bEAIQVQ",
  "undefeated-host": "CgkI4url5b4bEAIQTw",
  "word-hunter": "CgkI4url5b4bEAIQSQ",
  "word-master": "CgkI4url5b4bEAIQMQ",
  "word-solver": "CgkI4url5b4bEAIQPw",
  "zen-master": "CgkI4url5b4bEAIQWA",
};

/** Returns the Play Games achievement id for a local id, or null if unmapped. */
export function getPlayGamesAchievementId(localId: string): string | null {
  // Own-property check so ids like "constructor" can't hit Object.prototype.
  if (!Object.hasOwn(playGamesAchievementIds, localId)) {
    return null;
  }
  return playGamesAchievementIds[localId] ?? null;
}
