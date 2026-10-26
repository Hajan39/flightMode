import { getFlightReadyReminderFireAt } from "@/utils/notifications";

const MIN = 60 * 1000;
const now = 1_700_000_000_000;

describe("flight-ready reminder timing", () => {
  test("3 h before departure when there is time", () => {
    expect(getFlightReadyReminderFireAt(now + 5 * 60 * MIN, now)).toBe(
      now + 2 * 60 * MIN
    );
  });

  test("falls back to 30 min before when 3 h before has passed", () => {
    expect(getFlightReadyReminderFireAt(now + 2 * 60 * MIN, now)).toBe(
      now + 90 * MIN
    );
  });

  test("skips past, in-progress and imminent departures", () => {
    expect(getFlightReadyReminderFireAt(now - 60 * MIN, now)).toBeNull();
    expect(getFlightReadyReminderFireAt(now, now)).toBeNull();
    expect(getFlightReadyReminderFireAt(now + 29 * MIN, now)).toBeNull();
    expect(getFlightReadyReminderFireAt(now + 30 * MIN, now)).toBeNull();
    // 31 min out: 30 min before is only 1 min away (< 2 min lead)
    expect(getFlightReadyReminderFireAt(now + 31 * MIN, now)).toBeNull();
    expect(getFlightReadyReminderFireAt(Number.NaN, now)).toBeNull();
  });
});
