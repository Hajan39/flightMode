import {
  dateKeyDiffDays,
  getDayOfYear,
  nextStreakState,
  type StreakState,
} from "@/utils/dates";

describe("getDayOfYear", () => {
  /**
   * A local Date in Europe/Prague, independent of the runner's TZ (Jest's
   * sandboxed process.env can't switch zones at runtime): calendar fields as
   * given, `getTime()` as the real instant (CET +1 h, CEST +2 h).
   */
  function pragueDate(
    month: number,
    day: number,
    hour: number,
    minute: number,
    summer: boolean
  ): Date {
    const offsetH = summer ? 2 : 1;
    const instant = Date.UTC(2026, month, day, hour - offsetH, minute);
    return {
      getDate: () => day,
      getFullYear: () => 2026,
      getMonth: () => month,
      getTime: () => instant,
    } as Date;
  }

  test("Jan 1 = 1, Dec 31 = 365 / 366 in a leap year", () => {
    expect(getDayOfYear(new Date(2026, 0, 1, 0, 0))).toBe(1);
    expect(getDayOfYear(new Date(2026, 11, 31, 23, 59))).toBe(365);
    expect(getDayOfYear(new Date(2028, 11, 31, 12))).toBe(366);
  });

  test("stays constant all day during summer time (no flip at 01:00)", () => {
    // Mar 30 2026 is day 89; EU DST began on Mar 29 at 02:00.
    const early = pragueDate(2, 30, 0, 30, true);
    expect(getDayOfYear(early)).toBe(89);
    expect(getDayOfYear(pragueDate(2, 30, 1, 30, true))).toBe(89);
    expect(getDayOfYear(pragueDate(2, 30, 23, 59, true))).toBe(89);
    // Legacy floor(ms / 86 400 000) from Dec 31 00:00 CET still said 88.
    const dec31 = Date.UTC(2025, 11, 30, 23, 0);
    expect(Math.floor((early.getTime() - dec31) / 86_400_000)).toBe(88);
  });

  test("the DST switch days themselves", () => {
    expect(getDayOfYear(pragueDate(2, 29, 0, 10, false))).toBe(88);
    expect(getDayOfYear(pragueDate(2, 29, 23, 50, true))).toBe(88);
    expect(getDayOfYear(pragueDate(9, 25, 0, 10, true))).toBe(298);
    expect(getDayOfYear(pragueDate(9, 25, 23, 50, false))).toBe(298);
  });
});

describe("dateKeyDiffDays", () => {
  test("counts calendar days across month / year ends", () => {
    expect(dateKeyDiffDays("2026-01-31", "2026-02-01")).toBe(1);
    expect(dateKeyDiffDays("2025-12-31", "2026-01-02")).toBe(2);
    expect(dateKeyDiffDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(dateKeyDiffDays("2026-01-10", "2026-01-09")).toBe(-1);
  });
});

describe("nextStreakState", () => {
  const HNL = -600;
  const AKL = 780;
  const PRG = 60;
  const at = (
    lastActiveDate: string | null,
    streakDays: number,
    lastActiveOffsetMinutes?: number | null
  ): StreakState => ({ lastActiveDate, lastActiveOffsetMinutes, streakDays });

  test("first open starts at 1", () => {
    expect(nextStreakState(at(null, 0), "2026-01-10", PRG)).toEqual({
      lastActiveDate: "2026-01-10",
      lastActiveOffsetMinutes: PRG,
      streakDays: 1,
    });
  });

  test("next calendar day continues, a real 2-day gap resets", () => {
    expect(
      nextStreakState(at("2026-01-10", 3, PRG), "2026-01-11", PRG).streakDays
    ).toBe(4);
    expect(
      nextStreakState(at("2026-01-10", 3, PRG), "2026-01-12", PRG).streakDays
    ).toBe(1);
  });

  test("flying west over the date line: last date in the future keeps the streak", () => {
    // Opened Tue in Auckland, lands Mon in Honolulu.
    const next = nextStreakState(at("2026-01-13", 5, AKL), "2026-01-12", HNL);
    expect(next).toEqual({
      lastActiveDate: "2026-01-13",
      lastActiveOffsetMinutes: HNL,
      streakDays: 5,
    });
    // Tue in Honolulu is the same day → still 5; Wed continues to 6.
    expect(nextStreakState(next, "2026-01-13", HNL).streakDays).toBe(5);
    expect(nextStreakState(next, "2026-01-14", HNL).streakDays).toBe(6);
  });

  test("flying east over the date line: a skipped calendar day still counts", () => {
    // Opened Mon in Honolulu, lands Wed in Auckland (Tue never existed locally).
    expect(
      nextStreakState(at("2026-01-12", 5, HNL), "2026-01-14", AKL).streakDays
    ).toBe(6);
  });

  test("the date-line allowance needs an eastward ≥ 10 h jump and exactly 2 days", () => {
    // Small shift (Prague → Dubai) does not excuse a missed day.
    expect(
      nextStreakState(at("2026-01-12", 5, PRG), "2026-01-14", 240).streakDays
    ).toBe(1);
    // Westward jump with a gap is a real missed day.
    expect(
      nextStreakState(at("2026-01-12", 5, AKL), "2026-01-14", HNL).streakDays
    ).toBe(1);
    // 3-day gap resets even across the date line.
    expect(
      nextStreakState(at("2026-01-12", 5, HNL), "2026-01-15", AKL).streakDays
    ).toBe(1);
    // Legacy state without a stored offset: plain calendar semantics.
    expect(
      nextStreakState(at("2026-01-12", 5, null), "2026-01-14", AKL).streakDays
    ).toBe(1);
  });
});
