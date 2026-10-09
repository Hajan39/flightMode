/**
 * Platform-neutral scheme helpers, shared by `useColorScheme.ts` (native) and
 * `useColorScheme.web.ts` so both expose the same API — a helper that exists
 * in only one variant crashes the other platform at import time.
 */
export type ResolvedScheme = "light" | "dark" | "crazy" | "midnight" | "sunset";

/** Plus themes need the FlightMode Plus entitlement. */
export const PLUS_THEMES: ReadonlySet<string> = new Set(["midnight", "sunset"]);

/** The free scheme a Plus theme derives from (for per-scheme color overrides). */
export function baseScheme(scheme: ResolvedScheme): "light" | "dark" | "crazy" {
  return PLUS_THEMES.has(scheme)
    ? "dark"
    : (scheme as "light" | "dark" | "crazy");
}
