/**
 * Pure time-zone + jet-lag helpers (no React / RN imports).
 *
 * Intl time zones work on Hermes (RN ≥ 0.70 ships full ICU on both
 * platforms), but every entry point is wrapped in try/catch and falls back
 * to the destination's bundled standard-time offset so a missing ICU table
 * can never crash the Home screen — it only loses DST accuracy.
 */

export interface ZoneRef {
  /** IANA time zone name, e.g. "Asia/Tokyo". */
  timezone: string;
  /** Standard-time UTC offset in minutes, used when Intl is unavailable. */
  utcOffsetMinutes: number;
}

export interface TimezoneOptions {
  /** Force the offset fallback (used in tests). Default: true. */
  useIntl?: boolean;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  const cached = partsCache.get(timezone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  partsCache.set(timezone, formatter);
  return formatter;
}

/** UTC offset (minutes, east-positive) of `zone` at instant `atMs`, DST-aware via Intl. */
export function getZoneOffsetMinutes(
  atMs: number,
  zone: ZoneRef,
  opts?: TimezoneOptions
): number {
  if (opts?.useIntl === false) {
    return zone.utcOffsetMinutes;
  }
  try {
    const parts = getFormatter(zone.timezone).formatToParts(new Date(atMs));
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second")
    );
    if (!Number.isFinite(asUtc)) {
      return zone.utcOffsetMinutes;
    }
    // Compare against the instant truncated to whole seconds.
    const truncated = Math.floor(atMs / 1000) * 1000;
    return Math.round((asUtc - truncated) / 60_000);
  } catch {
    return zone.utcOffsetMinutes;
  }
}

/** Device's own UTC offset at `atMs` (minutes, east-positive). */
export function getDeviceOffsetMinutes(atMs: number): number {
  return -new Date(atMs).getTimezoneOffset();
}

function wallClock(atMs: number, offsetMinutes: number) {
  const shifted = new Date(atMs + offsetMinutes * 60_000);
  return {
    dayKey: Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    ),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** "HH:MM" (24h) wall-clock time in `zone` at `atMs`. */
export function formatTimeInZone(
  atMs: number,
  zone: ZoneRef,
  opts?: TimezoneOptions
): string {
  const { hours, minutes } = wallClock(
    atMs,
    getZoneOffsetMinutes(atMs, zone, opts)
  );
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Local hour (0–23) in `zone` at `atMs`. */
export function getHourInZone(
  atMs: number,
  zone: ZoneRef,
  opts?: TimezoneOptions
): number {
  return wallClock(atMs, getZoneOffsetMinutes(atMs, zone, opts)).hours;
}

/**
 * Calendar-day difference between `atMs` in `zone` and `referenceMs` on the
 * device: +1 when the destination date is already "tomorrow", -1 when it's
 * still "yesterday", 0 otherwise.
 */
export function getDayOffset(
  atMs: number,
  zone: ZoneRef,
  referenceMs: number,
  opts?: TimezoneOptions
): -1 | 0 | 1 {
  const target = wallClock(atMs, getZoneOffsetMinutes(atMs, zone, opts)).dayKey;
  const reference = wallClock(
    referenceMs,
    getDeviceOffsetMinutes(referenceMs)
  ).dayKey;
  const diff = Math.round((target - reference) / 86_400_000);
  if (diff > 0) {
    return 1;
  }
  if (diff < 0) {
    return -1;
  }
  return 0;
}

export type JetlagDirection = "east" | "west" | "none";
export type JetlagSeverity = "none" | "mild" | "moderate" | "severe";
export type JetlagAdviceKey =
  | "jetlagAdviceSleepBeforeArrival"
  | "jetlagAdviceStayAwake"
  | "jetlagAdviceShortNap"
  | "jetlagAdviceNone";

export interface JetlagPlan {
  adviceKey: JetlagAdviceKey;
  /** Local hour of arrival at the destination (0–23). */
  arrivalLocalHour: number;
  direction: JetlagDirection;
  severity: JetlagSeverity;
  /** Signed hour shift destination − home, rounded to 0.5 h. */
  shiftHours: number;
  /** Suggested on-plane sleep window in absolute ms, or null when not useful. */
  sleepWindow: { startMs: number; endMs: number } | null;
}

/** Lead time before the suggested sleep window starts. */
const JETLAG_REMINDER_LEAD_MS = 10 * 60_000;

/**
 * When to nudge the traveller that the on-plane sleep window is starting:
 * 10 minutes before it. Returns null when there is no window or the moment
 * has already passed (a reminder less than 2 minutes out is not worth it).
 */
export function getJetlagReminderFireAt(
  plan: JetlagPlan,
  nowMs: number
): number | null {
  if (!plan.sleepWindow) {
    return null;
  }
  const fireAt = plan.sleepWindow.startMs - JETLAG_REMINDER_LEAD_MS;
  if (fireAt <= nowMs + 2 * 60_000) {
    return null;
  }
  return fireAt;
}

export interface JetlagInput {
  departureTime: number;
  destination: ZoneRef;
  /** Flight duration in minutes. */
  duration: number;
  /** Home (departure) UTC offset in minutes; defaults to the device's offset. */
  homeOffsetMinutes?: number;
  nowMs: number;
  opts?: TimezoneOptions;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Simple, honest jet-lag heuristic:
 * - |shift| < 2 h → nothing to do.
 * - Morning arrival (05–11) → sleep in the last part of the flight so you
 *   wake up "in the morning" at the destination.
 * - Afternoon arrival (12–17) → a short nap now is fine, avoid deep sleep.
 * - Evening/night arrival (18–04) → stay awake, sleep after landing.
 */
export function getJetlagPlan(input: JetlagInput): JetlagPlan {
  const { departureTime, duration, nowMs, destination, opts } = input;
  const arrivalMs = departureTime + duration * MINUTE;
  const homeOffset =
    input.homeOffsetMinutes ?? getDeviceOffsetMinutes(departureTime);
  const destOffset = getZoneOffsetMinutes(arrivalMs, destination, opts);
  const shiftHours = Math.round(((destOffset - homeOffset) / 60) * 2) / 2;
  const abs = Math.abs(shiftHours);
  const arrivalLocalHour = getHourInZone(arrivalMs, destination, opts);

  let direction: JetlagDirection = "none";
  if (abs >= 2) {
    direction = shiftHours > 0 ? "east" : "west";
  }
  let severity: JetlagSeverity = "severe";
  if (abs < 2) {
    severity = "none";
  } else if (abs < 5) {
    severity = "mild";
  } else if (abs < 8) {
    severity = "moderate";
  }

  if (direction === "none") {
    return {
      adviceKey: "jetlagAdviceNone",
      arrivalLocalHour,
      direction,
      severity,
      shiftHours,
      sleepWindow: null,
    };
  }

  const remainingMs = Math.max(0, arrivalMs - nowMs);

  if (arrivalLocalHour >= 5 && arrivalLocalHour <= 11) {
    const endMs = arrivalMs - 45 * MINUTE;
    const maxLen = Math.min(remainingMs - 45 * MINUTE, 4 * HOUR);
    const sleepWindow =
      remainingMs >= 2 * HOUR && maxLen > 0
        ? { endMs, startMs: endMs - maxLen }
        : null;
    return {
      adviceKey: "jetlagAdviceSleepBeforeArrival",
      arrivalLocalHour,
      direction,
      severity,
      shiftHours,
      sleepWindow,
    };
  }

  if (arrivalLocalHour >= 12 && arrivalLocalHour <= 17) {
    const sleepWindow =
      remainingMs >= 3 * HOUR
        ? { endMs: nowMs + 90 * MINUTE, startMs: nowMs }
        : null;
    return {
      adviceKey: "jetlagAdviceShortNap",
      arrivalLocalHour,
      direction,
      severity,
      shiftHours,
      sleepWindow,
    };
  }

  return {
    adviceKey: "jetlagAdviceStayAwake",
    arrivalLocalHour,
    direction,
    severity,
    shiftHours,
    sleepWindow: null,
  };
}
