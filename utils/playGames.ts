/**
 * Google Play Games Services (PGS) wrapper.
 *
 * DESIGN CONTRACT
 * ───────────────
 * - This module is a *guarded no-op* until a native PGS module is present in the
 *   binary. In Expo Go, on iOS, in web, and in any build that hasn't linked a
 *   native PGS package, every call here silently does nothing and never throws.
 * - PGS is a *nice-to-have overlay* on top of the local achievement system. It
 *   must NEVER gate, block, or crash offline UX. The local unlock in
 *   `store/useAchievementStore.ts` is always the source of truth; pushing to
 *   Play Games is best-effort and fire-and-forget.
 *
 * WHY THE DYNAMIC REQUIRE
 * ───────────────────────
 * The only community RN Play Games libraries don't ship an Expo config plugin
 * and (as of writing) lack New Architecture support, so we don't add one to
 * `package.json` yet — that would risk the release build. Instead we resolve the
 * native module by name at runtime. The day a New-Architecture-safe module is
 * installed (custom native module or a maintained package), wire it into
 * `resolveNativeModule()` below and the rest of the app lights up unchanged.
 */

let signedIn = false;
let signInAttempted = false;

/**
 * Minimal shape we expect from whatever native module ends up providing PGS.
 * Only these calls are used; adapt `resolveNativeModule()` if a chosen library
 * exposes a different surface.
 */
type NativePlayGames = {
	signIn?: () => Promise<unknown>;
	signInSilently?: () => Promise<unknown>;
	isAuthenticated?: () => Promise<boolean>;
	unlockAchievement?: (playId: string) => Promise<unknown>;
	incrementAchievement?: (playId: string, steps: number) => Promise<unknown>;
	showAchievements?: () => Promise<unknown>;
};

/**
 * Returns the linked native PGS module, or null if none is present.
 *
 * Intentionally wrapped in try/catch: `require` of an unlinked native module
 * throws in JS-only environments (Expo Go, tests, web), and that's expected.
 */
function resolveNativeModule(): NativePlayGames | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const mod = require("react-native-google-play-game-services");
		return (mod?.default ?? mod ?? null) as NativePlayGames | null;
	} catch {
		return null;
	}
}

let cachedNative: NativePlayGames | null | undefined;
function getNative(): NativePlayGames | null {
	if (cachedNative === undefined) cachedNative = resolveNativeModule();
	return cachedNative;
}

/** True when a native PGS module is actually linked into this binary. */
export function isPlayGamesAvailable(): boolean {
	return getNative() !== null;
}

/** True after a successful (silent or interactive) sign-in this session. */
export function isPlayGamesSignedIn(): boolean {
	return signedIn;
}

/**
 * Attempt a silent sign-in once per app session. Safe to call on launch and
 * again lazily before pushing an achievement. Never throws.
 */
export async function initPlayGames(): Promise<void> {
	if (signInAttempted) return;
	signInAttempted = true;

	const native = getNative();
	if (!native) return;

	try {
		if (native.signInSilently) {
			await native.signInSilently();
			signedIn = true;
		} else if (native.isAuthenticated) {
			signedIn = await native.isAuthenticated();
		}
	} catch {
		// Silent sign-in can legitimately fail (user never linked Play Games,
		// no network, etc.). That's fine — we stay signed out and no-op.
		signedIn = false;
	}
}

/**
 * Push an achievement unlock to Play Games. Fire-and-forget: callers should NOT
 * await this on any UX-critical path. `playId` is the `CgkI...` id from
 * Play Console (see `data/playGamesAchievements.ts`); pass null/empty to skip.
 */
export async function unlockPlayGamesAchievement(
	playId: string | null | undefined,
): Promise<void> {
	if (!playId) return;

	const native = getNative();
	if (!native?.unlockAchievement) return;

	try {
		if (!signedIn) await initPlayGames();
		if (!signedIn) return;
		await native.unlockAchievement(playId);
	} catch {
		// Best-effort. A failed push must never surface to the user.
	}
}

/** Open the native Play Games achievements overlay, if available. Never throws. */
export async function showPlayGamesAchievements(): Promise<void> {
	const native = getNative();
	if (!native?.showAchievements) return;
	try {
		if (!signedIn) await initPlayGames();
		if (!signedIn) return;
		await native.showAchievements();
	} catch {
		// no-op
	}
}
