import type { RefObject } from "react";

/**
 * Helpers that clear a timer stored in a ref and null the ref.
 *
 * They take only refs, so an unmount cleanup can call them from
 * `useEffect(() => () => clearTimeoutRef(ref), [])` without depending on a
 * per-render (non-memoised) `clearTimers` function. Writing
 * `useEffect(() => clearTimers, [clearTimers])` with an unstable function
 * runs the cleanup after EVERY render and kills pending timers.
 */
export function clearTimeoutRef(
  ref: RefObject<ReturnType<typeof setTimeout> | null>
): void {
  if (ref.current !== null) {
    clearTimeout(ref.current);
  }
  ref.current = null;
}

export function clearIntervalRef(
  ref: RefObject<ReturnType<typeof setInterval> | null>
): void {
  if (ref.current !== null) {
    clearInterval(ref.current);
  }
  ref.current = null;
}
