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
/** Shared promise while a sign-in attempt is running (dedupes concurrent calls). */
let signInInFlight: Promise<void> | null = null;
/** Consecutive failed sign-ins and when the last one failed (for backoff). */
let failedAttempts = 0;
let lastFailedAt: number | null = null;

const SIGN_IN_BACKOFF_BASE_MS = 60_000;
const SIGN_IN_BACKOFF_MAX_MS = 15 * 60_000;

/**
 * Wait after `failures` consecutive failed sign-ins before trying again:
 * 1 min, 2 min, 4 min … capped at 15 min. Pure, exported for tests.
 */
export function getSignInBackoffMs(failures: number): number {
  if (failures <= 0) {
    return 0;
  }
  return Math.min(
    SIGN_IN_BACKOFF_BASE_MS * 2 ** (failures - 1),
    SIGN_IN_BACKOFF_MAX_MS
  );
}

/**
 * Supplies the Play ids of every locally unlocked achievement, so they can be
 * (re)sent after a sign-in succeeds — unlocks made while signed out would
 * otherwise never reach Play. Registered by `store/useAchievementStore.ts`
 * (injected to avoid a circular import).
 */
let unlockedPlayIdsSource: (() => string[]) | null = null;
export function setUnlockedPlayIdsSource(source: (() => string[]) | null) {
  unlockedPlayIdsSource = source;
}

/**
 * Minimal shape we expect from whatever native module ends up providing PGS.
 * Only these calls are used; adapt `resolveNativeModule()` if a chosen library
 * exposes a different surface.
 */
interface NativePlayGames {
  incrementAchievement?: (playId: string, steps: number) => Promise<void>;
  isAuthenticated?: () => Promise<boolean>;
  showAchievements?: () => Promise<void>;
  signInSilently?: () => Promise<boolean>;
  unlockAchievement?: (playId: string) => Promise<void>;
}

/**
 * Returns the linked native PGS module, or null if none is present.
 *
 * Resolves the local Expo module `modules/play-games` (registered natively as
 * "PlayGames"). Intentionally wrapped in try/catch: `requireNativeModule` throws
 * in JS-only environments (Expo Go, tests, web) and on iOS (the module is
 * Android-only), and that's the expected no-op path.
 */
function resolveNativeModule(): NativePlayGames | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("PlayGames") as NativePlayGames;
  } catch {
    return null;
  }
}

let cachedNative: NativePlayGames | null | undefined;
function getNative(): NativePlayGames | null {
  if (cachedNative === undefined) {
    cachedNative = resolveNativeModule();
  }
  return cachedNative;
}

/** Test seam: inject a fake native module (or null) and reset session state. */
export function __setNativeForTests(native: NativePlayGames | null) {
  cachedNative = native;
  signedIn = false;
  signInInFlight = null;
  failedAttempts = 0;
  lastFailedAt = null;
}

/** True when a native PGS module is actually linked into this binary. */
export function isPlayGamesAvailable(): boolean {
  return getNative() !== null;
}

/**
 * Whether the automatic (launch / network-back) Play Games sign-in may run.
 * Deferred until the persisted settings have loaded, onboarding is finished
 * and the user is off the onboarding screen, so the Play sign-in prompt never
 * pops up over the first-run flow. Returning users pass on the first render
 * after hydration. On-demand sign-in (achievement unlock, "show achievements")
 * is not gated by this.
 */
export function shouldAutoSignInPlayGames(state: {
  settingsHydrated: boolean;
  isFirstLaunch: boolean;
  /** First route segment, e.g. "(tabs)" or "onboarding"; undefined at root. */
  routeSegment: string | undefined;
}): boolean {
  return (
    state.settingsHydrated &&
    !state.isFirstLaunch &&
    state.routeSegment !== "onboarding"
  );
}

/** True after a successful (silent or interactive) sign-in this session. */
export function isPlayGamesSignedIn(): boolean {
  return signedIn;
}

/**
 * Attempt a silent sign-in. Safe to call on launch, on every unlock and when
 * the network comes back: no-op once signed in, deduped while an attempt is
 * running, and backed off after a failure (offline, Play still signing in, no
 * activity yet) instead of giving up for the whole session. After a successful
 * sign-in every locally unlocked achievement is re-sent. `ignoreBackoff` is
 * for strong signals such as the network becoming reachable. Never throws.
 */
export function initPlayGames(
  options: { ignoreBackoff?: boolean } = {}
): Promise<void> {
  if (signedIn) {
    return Promise.resolve();
  }
  if (signInInFlight) {
    return signInInFlight;
  }
  const native = getNative();
  if (!native) {
    return Promise.resolve();
  }
  if (
    !options.ignoreBackoff &&
    lastFailedAt !== null &&
    Date.now() - lastFailedAt < getSignInBackoffMs(failedAttempts)
  ) {
    return Promise.resolve();
  }

  signInInFlight = (async () => {
    let ok = false;
    try {
      if (native.signInSilently) {
        ok = Boolean(await native.signInSilently());
      } else if (native.isAuthenticated) {
        ok = Boolean(await native.isAuthenticated());
      }
    } catch {
      // Silent sign-in can legitimately fail (user never linked Play Games,
      // no network, etc.). We stay signed out and retry later with backoff.
      ok = false;
    }
    signedIn = ok;
    if (ok) {
      failedAttempts = 0;
      lastFailedAt = null;
    } else {
      failedAttempts += 1;
      lastFailedAt = Date.now();
    }
  })();

  const attempt = signInInFlight;
  return attempt
    .then(() => {
      signInInFlight = null;
      return signedIn ? resendUnlockedAchievements() : undefined;
    })
    .catch(() => {
      signInInFlight = null;
    });
}

/**
 * Re-sends every locally unlocked achievement that has a Play id. Unlocking is
 * idempotent on Play's side, so this is safe to repeat. No-op when signed out
 * or without the native module. Never throws.
 */
export async function resendUnlockedAchievements(): Promise<void> {
  const native = getNative();
  if (!(signedIn && native?.unlockAchievement && unlockedPlayIdsSource)) {
    return;
  }
  let playIds: string[] = [];
  try {
    playIds = [...new Set(unlockedPlayIdsSource().filter(Boolean))];
  } catch {
    return;
  }
  for (const playId of playIds) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — don't flood the native bridge
      await native.unlockAchievement(playId);
    } catch {
      // Best-effort per achievement.
    }
  }
}

/**
 * Push an achievement unlock to Play Games. Fire-and-forget: callers should NOT
 * await this on any UX-critical path. `playId` is the `CgkI...` id from
 * Play Console (see `data/playGamesAchievements.ts`); pass null/empty to skip.
 */
export async function unlockPlayGamesAchievement(
  playId: string | null | undefined
): Promise<void> {
  if (!playId) {
    return;
  }

  const native = getNative();
  if (!native?.unlockAchievement) {
    return;
  }

  try {
    if (!signedIn) {
      await initPlayGames();
    }
    if (!signedIn) {
      return;
    }
    await native.unlockAchievement(playId);
  } catch {
    // Best-effort. A failed push must never surface to the user.
  }
}

/** Open the native Play Games achievements overlay, if available. Never throws. */
export async function showPlayGamesAchievements(): Promise<void> {
  const native = getNative();
  if (!native?.showAchievements) {
    return;
  }
  try {
    if (!signedIn) {
      await initPlayGames();
    }
    if (!signedIn) {
      return;
    }
    await native.showAchievements();
  } catch {
    // no-op
  }
}
