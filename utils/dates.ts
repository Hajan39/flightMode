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
