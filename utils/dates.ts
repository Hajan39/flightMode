/**
 * Local-date helpers. Streaks and "today" checks must use the device's local
 * calendar day, not UTC — a traveller at 23:30 in Tokyo is still "today"
 * even though UTC has already rolled over.
 */

/** `YYYY-MM-DD` in the device's local time zone. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns a new Date shifted by `days` whole local days (handles month/year wrap). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `fromKey` to `toKey` (both `YYYY-MM-DD`); NaN if malformed. */
export function dateKeyDiffDays(fromKey: string, toKey: string): number {
  const parse = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / DAY_MS);
}

/**
 * 1-based day of the year for `date`'s local calendar day. Built from
 * `Date.UTC` calendar fields so DST (23 h / 25 h days) never shifts it —
 * subtracting local midnights flips the value at 01:00 during summer time.
 */
export function getDayOfYear(date: Date): number {
  const y = date.getFullYear();
  return Math.round(
    (Date.UTC(y, date.getMonth(), date.getDate()) - Date.UTC(y, 0, 0)) / DAY_MS
  );
}

export interface StreakState {
  lastActiveDate: string | null;
  /** Device UTC offset (minutes, east-positive) at the last streak update. */
  lastActiveOffsetMinutes?: number | null;
  streakDays: number;
}

/** A UTC-offset jump this large between opens means the date line was crossed. */
const DATE_LINE_OFFSET_JUMP_MINUTES = 10 * 60;

/**
 * Next daily-streak state for an app open on local day `today` with device
 * offset `offsetMinutes`. Local-calendar-day semantics, with two traveller
 * edge cases:
 * - `lastActiveDate` on or after `today` (flying west over the date line
 *   lands you on "yesterday") → streak unchanged, last date kept.
 * - a 2-day gap that coincides with an eastward offset jump of ≥ 10 h
 *   (flying east over the date line skips a calendar day) → consecutive.
 */
export function nextStreakState(
  prev: StreakState,
  today: string,
  offsetMinutes: number
): StreakState {
  const { lastActiveDate } = prev;
  if (lastActiveDate && lastActiveDate >= today) {
    return {
      lastActiveDate,
      lastActiveOffsetMinutes: offsetMinutes,
      streakDays: prev.streakDays,
    };
  }
  const gap = lastActiveDate
    ? dateKeyDiffDays(lastActiveDate, today)
    : Number.NaN;
  const prevOffset = prev.lastActiveOffsetMinutes;
  const crossedDateLine =
    gap === 2 &&
    typeof prevOffset === "number" &&
    offsetMinutes - prevOffset >= DATE_LINE_OFFSET_JUMP_MINUTES;
  const consecutive = gap === 1 || crossedDateLine;
  return {
    lastActiveDate: today,
    lastActiveOffsetMinutes: offsetMinutes,
    streakDays: consecutive ? prev.streakDays + 1 : 1,
  };
}
