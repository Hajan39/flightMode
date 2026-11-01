/**
 * Kids mode — pure decisions (no React, no stores), unit-tested in
 * `__tests__/kidsMode.test.ts`.
 *
 * While kids mode is on the app is a closed picture-game area for ages 3–6:
 * the root layout keeps every route inside `/kids`, and leaving needs the
 * parent lock (press and hold for `PARENT_HOLD_MS`).
 */

/** First route segment of the kids area (`app/kids/*`). */
export const KIDS_SEGMENT = "kids";

/** How long the parent lock must be held to leave kids mode. */
export const PARENT_HOLD_MS = 3000;

/** Haptic tick spacing while the parent lock is held (one per second). */
export const PARENT_HOLD_TICK_MS = 1000;

export type RootRedirect = "/onboarding" | "/kids" | "/" | null;

/**
 * Where the root layout must send the user right now (null = stay).
 * - Settings not hydrated yet → never redirect (defaults are not the truth).
 * - Kids mode on → everything outside `/kids` goes to `/kids` (deep links,
 *   notifications, the hardware back that would reveal adult screens). It
 *   wins over onboarding: the lock is the safety guarantee. (A first-launch
 *   user cannot have turned kids mode on, so the two never really meet.)
 * - Kids mode off → the kids area is unreachable (`/kids` deep link → Home);
 *   first launch → onboarding.
 */
export function decideRootRedirect(input: {
  hydrated: boolean;
  isFirstLaunch: boolean;
  kidsMode: boolean;
  /** `useSegments()[0]` — undefined at the root index. */
  segment: string | undefined;
}): RootRedirect {
  if (!input.hydrated) {
    return null;
  }
  if (input.kidsMode) {
    return input.segment === KIDS_SEGMENT ? null : "/kids";
  }
  if (input.segment === KIDS_SEGMENT) {
    return input.isFirstLaunch ? "/onboarding" : "/";
  }
  if (input.isFirstLaunch && input.segment !== "onboarding") {
    return "/onboarding";
  }
  return null;
}

export interface ParentHoldState {
  /** True once the lock was held for the full `PARENT_HOLD_MS`. */
  done: boolean;
  /** 0…1 fill of the progress ring. */
  progress: number;
  /** Whole seconds held so far (a haptic tick fires when this grows). */
  ticks: number;
}

/**
 * State of a press-and-hold that started at `startedAt` (ms, wall clock) as
 * seen at `now`. `startedAt === null` = not pressed. Derived from the clock,
 * never from counted timer ticks (CLAUDE.md timer rule).
 */
export function parentHoldState(
  startedAt: number | null,
  now: number,
  holdMs = PARENT_HOLD_MS
): ParentHoldState {
  if (startedAt === null || !Number.isFinite(startedAt)) {
    return { done: false, progress: 0, ticks: 0 };
  }
  const held = Math.max(0, now - startedAt);
  const progress = Math.min(1, held / holdMs);
  return {
    done: held >= holdMs,
    progress,
    ticks: Math.min(
      Math.floor(holdMs / PARENT_HOLD_TICK_MS),
      Math.floor(held / PARENT_HOLD_TICK_MS)
    ),
  };
}

/** Kids grid columns: 2 on phones, 3 from small-tablet widths. */
export function kidsGridColumns(windowWidth: number): number {
  return windowWidth >= 600 ? 3 : 2;
}
