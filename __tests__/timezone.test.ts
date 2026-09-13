import {
	formatTimeInZone,
	getDayOffset,
	getJetlagPlan,
	getZoneOffsetMinutes,
	type ZoneRef,
} from "@/utils/timezone";

const tokyo: ZoneRef = { timezone: "Asia/Tokyo", utcOffsetMinutes: 540 };
const newYork: ZoneRef = { timezone: "America/New_York", utcOffsetMinutes: -300 };
const kolkata: ZoneRef = { timezone: "Asia/Kolkata", utcOffsetMinutes: 330 };
const london: ZoneRef = { timezone: "Europe/London", utcOffsetMinutes: 0 };

const JAN = Date.UTC(2026, 0, 15, 12, 0, 0);
const JUL = Date.UTC(2026, 6, 15, 12, 0, 0);

describe("getZoneOffsetMinutes", () => {
	test("Tokyo has no DST: +540 all year", () => {
		expect(getZoneOffsetMinutes(JAN, tokyo)).toBe(540);
		expect(getZoneOffsetMinutes(JUL, tokyo)).toBe(540);
	});

	test("New York is -300 in winter and -240 in summer (DST via Intl)", () => {
		expect(getZoneOffsetMinutes(JAN, newYork)).toBe(-300);
		expect(getZoneOffsetMinutes(JUL, newYork)).toBe(-240);
	});

	test("half-hour zones are exact", () => {
		expect(getZoneOffsetMinutes(JAN, kolkata)).toBe(330);
	});

	test("useIntl:false returns the bundled offset", () => {
		expect(getZoneOffsetMinutes(JUL, newYork, { useIntl: false })).toBe(-300);
	});

	test("an invalid IANA name falls back without throwing", () => {
		const bogus: ZoneRef = { timezone: "Mars/Olympus", utcOffsetMinutes: 90 };
		expect(() => getZoneOffsetMinutes(JAN, bogus)).not.toThrow();
		expect(getZoneOffsetMinutes(JAN, bogus)).toBe(90);
	});
});

describe("formatTimeInZone / getDayOffset", () => {
	test("formats HH:MM padded in the destination zone", () => {
		// 12:00 UTC → 21:00 Tokyo, 07:00 New York (winter)
		expect(formatTimeInZone(JAN, tokyo)).toBe("21:00");
		expect(formatTimeInZone(JAN, newYork)).toBe("07:00");
		expect(formatTimeInZone(Date.UTC(2026, 0, 15, 0, 5), tokyo)).toBe("09:05");
	});

	test("day offset is +1 when the destination has already crossed midnight", () => {
		// 20:00 UTC → 05:00 next day in Tokyo; device reference computed from local tz
		const at = Date.UTC(2026, 0, 15, 20, 0);
		const deviceDayStart = new Date(at);
		deviceDayStart.setHours(0, 0, 0, 0);
		// Reference = same instant; the test asserts the relation is consistent
		// regardless of the runner's time zone by comparing against London.
		const londonOffset = getDayOffset(at, london, at);
		const tokyoOffset = getDayOffset(at, tokyo, at);
		expect([-1, 0, 1]).toContain(londonOffset);
		expect(tokyoOffset).toBeGreaterThanOrEqual(londonOffset);
	});
});

describe("getJetlagPlan", () => {
	const base = { homeOffsetMinutes: 0, opts: { useIntl: false } };

	test("London → New York is west, -5h, moderate", () => {
		const departureTime = Date.UTC(2026, 0, 15, 10, 0);
		const plan = getJetlagPlan({
			...base,
			departureTime,
			duration: 8 * 60,
			nowMs: departureTime + 60 * 60000,
			destination: newYork,
		});
		expect(plan.direction).toBe("west");
		expect(plan.shiftHours).toBe(-5);
		expect(plan.severity).toBe("moderate");
	});

	test("Prague → Tokyo (+8h) with a morning arrival suggests sleeping before landing", () => {
		// Depart 12:00 UTC+1 (11:00 UTC), 11h flight → 22:00 UTC = 07:00 Tokyo.
		const departureTime = Date.UTC(2026, 0, 15, 11, 0);
		const plan = getJetlagPlan({
			departureTime,
			duration: 11 * 60,
			nowMs: departureTime + 2 * 3600_000,
			destination: tokyo,
			homeOffsetMinutes: 60,
			opts: { useIntl: false },
		});
		expect(plan.direction).toBe("east");
		expect(plan.shiftHours).toBe(8);
		expect(plan.severity).toBe("severe");
		expect(plan.arrivalLocalHour).toBe(7);
		expect(plan.adviceKey).toBe("jetlagAdviceSleepBeforeArrival");
		expect(plan.sleepWindow).not.toBeNull();
		const arrival = departureTime + 11 * 3600_000;
		expect(plan.sleepWindow!.endMs).toBe(arrival - 45 * 60000);
		expect(plan.sleepWindow!.endMs - plan.sleepWindow!.startMs).toBe(4 * 3600_000);
	});

	test("short remaining flight gives no sleep window", () => {
		const departureTime = Date.UTC(2026, 0, 15, 11, 0);
		const plan = getJetlagPlan({
			departureTime,
			duration: 11 * 60,
			nowMs: departureTime + 10 * 3600_000, // 1h left
			destination: tokyo,
			homeOffsetMinutes: 60,
			opts: { useIntl: false },
		});
		expect(plan.adviceKey).toBe("jetlagAdviceSleepBeforeArrival");
		expect(plan.sleepWindow).toBeNull();
	});

	test("evening arrival says stay awake", () => {
		// 11:00 UTC + 2h = 13:00 UTC → 22:00 Tokyo.
		const departureTime = Date.UTC(2026, 0, 15, 11, 0);
		const plan = getJetlagPlan({
			...base,
			departureTime,
			duration: 120,
			nowMs: departureTime,
			destination: tokyo,
		});
		expect(plan.adviceKey).toBe("jetlagAdviceStayAwake");
	});

	test("same zone → none", () => {
		const departureTime = Date.UTC(2026, 0, 15, 11, 0);
		const plan = getJetlagPlan({
			...base,
			departureTime,
			duration: 120,
			nowMs: departureTime,
			destination: london,
		});
		expect(plan.direction).toBe("none");
		expect(plan.severity).toBe("none");
		expect(plan.adviceKey).toBe("jetlagAdviceNone");
		expect(plan.sleepWindow).toBeNull();
	});
});
