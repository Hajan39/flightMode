import {
  formatTimeInZone,
  getDayOffset,
  getJetlagPlan,
  getJetlagReminderFireAt,
  getZoneOffsetMinutes,
  type JetlagPlan,
  type ZoneRef,
} from "@/utils/timezone";

const tokyo: ZoneRef = { timezone: "Asia/Tokyo", utcOffsetMinutes: 540 };
const newYork: ZoneRef = {
  timezone: "America/New_York",
  utcOffsetMinutes: -300,
};
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

  describe("getDayOffset with the device pinned to UTC", () => {
    // The device side uses Date#getTimezoneOffset; pin it so the expected
    // values do not depend on the CI runner's time zone.
    let spy: jest.SpyInstance;
    beforeEach(() => {
      spy = jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(0);
    });
    afterEach(() => spy.mockRestore());

    test("+1 when the destination has already crossed midnight", () => {
      // 20:00 UTC on the 15th → 05:00 on the 16th in Tokyo.
      const at = Date.UTC(2026, 0, 15, 20, 0);
      expect(getDayOffset(at, tokyo, at)).toBe(1);
    });

    test("-1 when the destination is still on yesterday", () => {
      // 02:00 UTC on the 15th → 21:00 on the 14th in New York.
      const at = Date.UTC(2026, 0, 15, 2, 0);
      expect(getDayOffset(at, newYork, at)).toBe(-1);
    });

    test("0 on the same calendar day", () => {
      const at = Date.UTC(2026, 0, 15, 12, 0);
      expect(getDayOffset(at, london, at)).toBe(0);
      expect(getDayOffset(at, tokyo, at)).toBe(0);
      expect(getDayOffset(at, newYork, at)).toBe(0);
    });

    test("compares against the reference instant, not `at`", () => {
      // Arrival two days later still reports only "+1" (clamped).
      const ref = Date.UTC(2026, 0, 15, 12, 0);
      expect(getDayOffset(ref + 48 * 3_600_000, london, ref)).toBe(1);
      expect(getDayOffset(ref - 48 * 3_600_000, london, ref)).toBe(-1);
    });
  });
});

describe("getJetlagPlan", () => {
  const base = { homeOffsetMinutes: 0, opts: { useIntl: false } };

  test("London → New York is west, -5h, moderate", () => {
    const departureTime = Date.UTC(2026, 0, 15, 10, 0);
    const plan = getJetlagPlan({
      ...base,
      departureTime,
      destination: newYork,
      duration: 8 * 60,
      nowMs: departureTime + 60 * 60_000,
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
      destination: tokyo,
      duration: 11 * 60,
      homeOffsetMinutes: 60,
      nowMs: departureTime + 2 * 3_600_000,
      opts: { useIntl: false },
    });
    expect(plan.direction).toBe("east");
    expect(plan.shiftHours).toBe(8);
    expect(plan.severity).toBe("severe");
    expect(plan.arrivalLocalHour).toBe(7);
    expect(plan.adviceKey).toBe("jetlagAdviceSleepBeforeArrival");
    expect(plan.sleepWindow).not.toBeNull();
    const arrival = departureTime + 11 * 3_600_000;
    expect(plan.sleepWindow?.endMs).toBe(arrival - 45 * 60_000);
    expect(plan.sleepWindow?.endMs - plan.sleepWindow?.startMs).toBe(
      4 * 3_600_000
    );
  });

  test("short remaining flight gives no sleep window", () => {
    const departureTime = Date.UTC(2026, 0, 15, 11, 0);
    const plan = getJetlagPlan({
      departureTime,
      destination: tokyo,
      duration: 11 * 60,
      homeOffsetMinutes: 60,
      nowMs: departureTime + 10 * 3_600_000, // 1h left
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
      destination: tokyo,
      duration: 120,
      nowMs: departureTime,
    });
    expect(plan.adviceKey).toBe("jetlagAdviceStayAwake");
  });

  /** UTC home, Tokyo (+9 h) destination: arrival hour = arrival UTC hour + 9. */
  function tokyoPlan(
    arrivalUtcHour: number,
    durationH: number,
    nowAfterDepH = 0
  ) {
    const arrival = Date.UTC(2026, 0, 16, arrivalUtcHour, 0);
    const departureTime = arrival - durationH * 3_600_000;
    return {
      arrival,
      departureTime,
      plan: getJetlagPlan({
        ...base,
        departureTime,
        destination: tokyo,
        duration: durationH * 60,
        nowMs: departureTime + nowAfterDepH * 3_600_000,
      }),
    };
  }

  test("arrival-hour buckets: 05–11 sleep, 12–17 nap, 18–04 stay awake", () => {
    const advice = (utcHour: number) => tokyoPlan(utcHour, 10).plan.adviceKey;
    // Tokyo local = UTC + 9
    expect(advice(19)).toBe("jetlagAdviceStayAwake"); // 04:00
    expect(advice(20)).toBe("jetlagAdviceSleepBeforeArrival"); // 05:00
    expect(advice(2)).toBe("jetlagAdviceSleepBeforeArrival"); // 11:00
    expect(advice(3)).toBe("jetlagAdviceShortNap"); // 12:00
    expect(advice(8)).toBe("jetlagAdviceShortNap"); // 17:00
    expect(advice(9)).toBe("jetlagAdviceStayAwake"); // 18:00
    expect(tokyoPlan(9, 10).plan.sleepWindow).toBeNull();
  });

  test("afternoon arrival: a 90-minute nap from now, only with ≥ 3 h left", () => {
    const { plan, departureTime } = tokyoPlan(5, 5); // 14:00 Tokyo
    expect(plan.adviceKey).toBe("jetlagAdviceShortNap");
    expect(plan.sleepWindow).toEqual({
      endMs: departureTime + 90 * 60_000,
      startMs: departureTime,
    });
    expect(tokyoPlan(5, 5, 2).plan.sleepWindow).not.toBeNull(); // exactly 3 h left
    expect(tokyoPlan(5, 5, 2.5).plan.sleepWindow).toBeNull(); // 2.5 h left
  });

  test("morning arrival: window ends 45 min before landing, shrinks to fit the time left", () => {
    const { plan, arrival } = tokyoPlan(22, 11, 8); // 07:00 Tokyo, 3 h left
    expect(plan.sleepWindow).toEqual({
      endMs: arrival - 45 * 60_000,
      startMs: arrival - 3 * 3_600_000,
    });
    // Exactly 2 h left still gets a (75 min) window; less than that, none.
    const twoLeft = tokyoPlan(22, 11, 9).plan.sleepWindow;
    expect(twoLeft && twoLeft.endMs - twoLeft.startMs).toBe(75 * 60_000);
    expect(tokyoPlan(22, 11, 9.5).plan.sleepWindow).toBeNull();
  });

  test("severity thresholds: <2 none, 2–<5 mild, 5–<8 moderate, ≥8 severe", () => {
    const severity = (homeOffsetMinutes: number) =>
      getJetlagPlan({
        departureTime: JAN,
        destination: london,
        duration: 60,
        homeOffsetMinutes,
        nowMs: JAN,
        opts: { useIntl: false },
      });
    expect(severity(90)).toMatchObject({ direction: "none", severity: "none" });
    expect(severity(120)).toMatchObject({
      direction: "west",
      severity: "mild",
      shiftHours: -2,
    });
    expect(severity(-270)).toMatchObject({
      direction: "east",
      severity: "mild",
      shiftHours: 4.5,
    });
    expect(severity(-300)).toMatchObject({
      severity: "moderate",
      shiftHours: 5,
    });
    expect(severity(-420)).toMatchObject({ severity: "moderate" });
    expect(severity(-480)).toMatchObject({ severity: "severe" });
  });

  test("shift is rounded to the nearest half hour", () => {
    const plan = getJetlagPlan({
      departureTime: JAN,
      destination: kolkata,
      duration: 60,
      homeOffsetMinutes: 0,
      nowMs: JAN,
      opts: { useIntl: false },
    });
    expect(plan.shiftHours).toBe(5.5);
  });

  test("same zone → none", () => {
    const departureTime = Date.UTC(2026, 0, 15, 11, 0);
    const plan = getJetlagPlan({
      ...base,
      departureTime,
      destination: london,
      duration: 120,
      nowMs: departureTime,
    });
    expect(plan.direction).toBe("none");
    expect(plan.severity).toBe("none");
    expect(plan.adviceKey).toBe("jetlagAdviceNone");
    expect(plan.sleepWindow).toBeNull();
  });
});

describe("getJetlagReminderFireAt", () => {
  const base: JetlagPlan = {
    adviceKey: "jetlagAdviceSleepBeforeArrival",
    arrivalLocalHour: 7,
    direction: "east",
    severity: "severe",
    shiftHours: 8,
    sleepWindow: null,
  };

  test("fires 10 minutes before the sleep window opens", () => {
    const start = Date.UTC(2026, 0, 15, 18, 0);
    const plan = {
      ...base,
      sleepWindow: { endMs: start + 4 * 3_600_000, startMs: start },
    };
    expect(getJetlagReminderFireAt(plan, start - 3_600_000)).toBe(
      start - 10 * 60_000
    );
  });

  test("null without a window", () => {
    expect(getJetlagReminderFireAt(base, Date.now())).toBeNull();
  });

  test("null when the window is already here or too close", () => {
    const start = Date.UTC(2026, 0, 15, 18, 0);
    const plan = {
      ...base,
      sleepWindow: { endMs: start + 3_600_000, startMs: start },
    };
    expect(getJetlagReminderFireAt(plan, start)).toBeNull();
    // 10 min lead minus a 2 min floor → a now 9 minutes before the window is too late
    expect(getJetlagReminderFireAt(plan, start - 9 * 60_000)).toBeNull();
    expect(getJetlagReminderFireAt(plan, start - 13 * 60_000)).toBe(
      start - 10 * 60_000
    );
  });
});
