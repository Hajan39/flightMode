import { useEffect, useEffectEvent } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * True when the app just left the foreground: `active` → `inactive` (iOS
 * reports `inactive` for the app switcher, Control Centre and incoming calls)
 * or any non-background state → `background`. The latter also covers iOS
 * `inactive` → `background` when the hook was enabled while `inactive` (it
 * never saw the `active` → `inactive` step). Unknown / extension states never
 * trigger a pause on their own.
 */
export function leftForeground(
  prev: AppStateStatus | null | undefined,
  next: AppStateStatus
): boolean {
  if (next === "background") {
    return prev !== "background";
  }
  return prev === "active" && next === "inactive";
}

/**
 * Wall-clock deadline pushed back by a pause. 0 (= "off") stays 0, so
 * "no timer running" is never turned into a running one.
 */
export function shiftDeadline(until: number, pausedMs: number): number {
  if (until <= 0 || pausedMs <= 0) {
    return until;
  }
  return until + pausedMs;
}

/**
 * Calls `onPause` when the app leaves the foreground (home button, app
 * switcher, incoming call, screen lock) so a real-time game never keeps
 * running unseen. It never resumes on its own — the player resumes from the
 * game's pause overlay. Pass `enabled = false` while there is nothing to
 * pause (menu, result screen, already paused).
 */
export function useAutoPause(onPause: () => void, enabled = true): void {
  const pauseNow = useEffectEvent(onPause);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (leftForeground(prev, next)) {
        pauseNow();
      }
      prev = next;
    });
    return () => sub.remove();
  }, [enabled]);
}
