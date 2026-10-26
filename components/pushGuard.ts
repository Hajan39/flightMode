/** How long a second navigation tap is ignored after the first one. */
export const PUSH_GUARD_WINDOW_MS = 600;

/**
 * Returns a gate that lets one call through and rejects any further call
 * within `windowMs` — a double tap on a card must not stack two screens.
 */
export function createPushGuard(
  windowMs = PUSH_GUARD_WINDOW_MS,
  now: () => number = Date.now
): () => boolean {
  let lastAt = Number.NEGATIVE_INFINITY;
  return () => {
    const at = now();
    if (at - lastAt < windowMs) {
      return false;
    }
    lastAt = at;
    return true;
  };
}
