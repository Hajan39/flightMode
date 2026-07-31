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
	// ── Player ──
	"first-game": null,
	"game-explorer": null,
	"game-master": null,
	marathon: null,
	"high-scorer": null,
	// ── Quiz ──
	"quiz-ace": null,
	"know-it-all": null,
	scholar: null,
	// ── Relax ──
	"deep-breath": null,
	"zen-master": null,
	soundscaper: null,
	// ── Traveler ──
	bookworm: null,
	explorer: null,
	"frequent-flyer": null,
	globetrotter: null,
	"streak-3": null,
	"streak-7": null,
	// ── Special ──
	"speed-demon": null,
	"perfect-landing": null,
	"sky-guardian": null,
	"sky-commander": null,
	"tower-operator": null,
	"air-boss": null,
	"word-solver": null,
	"word-master": null,
	"sudoku-novice": null,
	"sudoku-master": null,
	"snake-charmer": null,
	"puzzle-slider": null,
	"cargo-captain": null,
	"word-hunter": null,
	// ── Logic games ──
	"ground-controller": null,
	"pixel-artist": null,
	equilibrium: null,
};

/** Returns the Play Games achievement id for a local id, or null if unmapped. */
export function getPlayGamesAchievementId(localId: string): string | null {
	// Own-property check so ids like "constructor" can't hit Object.prototype.
	if (!Object.prototype.hasOwnProperty.call(playGamesAchievementIds, localId)) {
		return null;
	}
	return playGamesAchievementIds[localId] ?? null;
}
