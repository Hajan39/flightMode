/**
 * Pure time-zone + jet-lag helpers (no React / RN imports).
 *
 * Intl time zones work on Hermes (RN ≥ 0.70 ships full ICU on both
 * platforms), but every entry point is wrapped in try/catch and falls back
 * to the destination's bundled standard-time offset so a missing ICU table
 * can never crash the Home screen — it only loses DST accuracy.
 */

export type ZoneRef = {
	/** IANA time zone name, e.g. "Asia/Tokyo". */
	timezone: string;
	/** Standard-time UTC offset in minutes, used when Intl is unavailable. */
	utcOffsetMinutes: number;
};

export type TimezoneOptions = {
	/** Force the offset fallback (used in tests). Default: true. */
	useIntl?: boolean;
};

const partsCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
	const cached = partsCache.get(timezone);
	if (cached) return cached;
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	partsCache.set(timezone, formatter);
	return formatter;
}

/** UTC offset (minutes, east-positive) of `zone` at instant `atMs`, DST-aware via Intl. */
export function getZoneOffsetMinutes(
	atMs: number,
	zone: ZoneRef,
	opts?: TimezoneOptions,
): number {
	if (opts?.useIntl === false) return zone.utcOffsetMinutes;
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
			get("second"),
		);
		if (!Number.isFinite(asUtc)) return zone.utcOffsetMinutes;
		// Compare against the instant truncated to whole seconds.
		const truncated = Math.floor(atMs / 1000) * 1000;
		return Math.round((asUtc - truncated) / 60000);
	} catch {
		return zone.utcOffsetMinutes;
	}
}

/** Device's own UTC offset at `atMs` (minutes, east-positive). */
export function getDeviceOffsetMinutes(atMs: number): number {
	return -new Date(atMs).getTimezoneOffset();
}

function wallClock(atMs: number, offsetMinutes: number) {
	const shifted = new Date(atMs + offsetMinutes * 60000);
	return {
		hours: shifted.getUTCHours(),
		minutes: shifted.getUTCMinutes(),
		dayKey: Date.UTC(
			shifted.getUTCFullYear(),
			shifted.getUTCMonth(),
			shifted.getUTCDate(),
		),
	};
}

/** "HH:MM" (24h) wall-clock time in `zone` at `atMs`. */
export function formatTimeInZone(
	atMs: number,
	zone: ZoneRef,
	opts?: TimezoneOptions,
): string {
	const { hours, minutes } = wallClock(
		atMs,
		getZoneOffsetMinutes(atMs, zone, opts),
	);
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Local hour (0–23) in `zone` at `atMs`. */
export function getHourInZone(
	atMs: number,
	zone: ZoneRef,
	opts?: TimezoneOptions,
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
	opts?: TimezoneOptions,
): -1 | 0 | 1 {
	const target = wallClock(atMs, getZoneOffsetMinutes(atMs, zone, opts)).dayKey;
	const reference = wallClock(
		referenceMs,
		getDeviceOffsetMinutes(referenceMs),
	).dayKey;
	const diff = Math.round((target - reference) / 86_400_000);
	return diff > 0 ? 1 : diff < 0 ? -1 : 0;
}

export type JetlagDirection = "east" | "west" | "none";
export type JetlagSeverity = "none" | "mild" | "moderate" | "severe";
export type JetlagAdviceKey =
	| "jetlagAdviceSleepBeforeArrival"
	| "jetlagAdviceStayAwake"
	| "jetlagAdviceShortNap"
	| "jetlagAdviceNone";

export type JetlagPlan = {
	/** Signed hour shift destination − home, rounded to 0.5 h. */
	shiftHours: number;
	direction: JetlagDirection;
	severity: JetlagSeverity;
	/** Local hour of arrival at the destination (0–23). */
	arrivalLocalHour: number;
	/** Suggested on-plane sleep window in absolute ms, or null when not useful. */
	sleepWindow: { startMs: number; endMs: number } | null;
	adviceKey: JetlagAdviceKey;
};

/** Lead time before the suggested sleep window starts. */
const JETLAG_REMINDER_LEAD_MS = 10 * 60_000;

/**
 * When to nudge the traveller that the on-plane sleep window is starting:
 * 10 minutes before it. Returns null when there is no window or the moment
 * has already passed (a reminder less than 2 minutes out is not worth it).
 */
export function getJetlagReminderFireAt(
	plan: JetlagPlan,
	nowMs: number,
): number | null {
	if (!plan.sleepWindow) return null;
	const fireAt = plan.sleepWindow.startMs - JETLAG_REMINDER_LEAD_MS;
	if (fireAt <= nowMs + 2 * 60_000) return null;
	return fireAt;
}

export type JetlagInput = {
	departureTime: number;
	/** Flight duration in minutes. */
	duration: number;
	nowMs: number;
	destination: ZoneRef;
	/** Home (departure) UTC offset in minutes; defaults to the device's offset. */
	homeOffsetMinutes?: number;
	opts?: TimezoneOptions;
};

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

	const direction: JetlagDirection =
		abs < 2 ? "none" : shiftHours > 0 ? "east" : "west";
	const severity: JetlagSeverity =
		abs < 2 ? "none" : abs < 5 ? "mild" : abs < 8 ? "moderate" : "severe";

	if (direction === "none") {
		return {
			shiftHours,
			direction,
			severity,
			arrivalLocalHour,
			sleepWindow: null,
			adviceKey: "jetlagAdviceNone",
		};
	}

	const remainingMs = Math.max(0, arrivalMs - nowMs);

	if (arrivalLocalHour >= 5 && arrivalLocalHour <= 11) {
		const endMs = arrivalMs - 45 * MINUTE;
		const maxLen = Math.min(remainingMs - 45 * MINUTE, 4 * HOUR);
		const sleepWindow =
			remainingMs >= 2 * HOUR && maxLen > 0
				? { startMs: endMs - maxLen, endMs }
				: null;
		return {
			shiftHours,
			direction,
			severity,
			arrivalLocalHour,
			sleepWindow,
			adviceKey: "jetlagAdviceSleepBeforeArrival",
		};
	}

	if (arrivalLocalHour >= 12 && arrivalLocalHour <= 17) {
		const sleepWindow =
			remainingMs >= 3 * HOUR
				? { startMs: nowMs, endMs: nowMs + 90 * MINUTE }
				: null;
		return {
			shiftHours,
			direction,
			severity,
			arrivalLocalHour,
			sleepWindow,
			adviceKey: "jetlagAdviceShortNap",
		};
	}

	return {
		shiftHours,
		direction,
		severity,
		arrivalLocalHour,
		sleepWindow: null,
		adviceKey: "jetlagAdviceStayAwake",
	};
}
