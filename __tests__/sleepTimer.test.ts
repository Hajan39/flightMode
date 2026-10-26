import { shouldStopForSleepTimer } from "@/utils/sleepTimer";

describe("sleep timer deadline", () => {
  test("no timer never stops", () => {
    expect(shouldStopForSleepTimer(null, Date.now())).toBe(false);
  });

  test("stops at or after the wall-clock deadline, not before", () => {
    const endAt = 1_000_000;
    expect(shouldStopForSleepTimer(endAt, endAt - 1)).toBe(false);
    expect(shouldStopForSleepTimer(endAt, endAt)).toBe(true);
    // e.g. JS timers paused with the screen off, checked an hour late
    expect(shouldStopForSleepTimer(endAt, endAt + 3_600_000)).toBe(true);
  });

  test("garbage deadlines are ignored", () => {
    expect(shouldStopForSleepTimer(Number.NaN, 5)).toBe(false);
  });
});
