import { getPassportSummary, upsertLoggedFlight } from "@/utils/passport";

const H = 3_600_000;
const now = 100 * H;

describe("flight passport", () => {
  test("upsert replaces an edited flight instead of adding a second stamp", () => {
    let log = upsertLoggedFlight([], {
      departureTime: 0,
      duration: 60,
      id: "a",
    });
    log = upsertLoggedFlight(log, {
      departureTime: 0,
      destinationId: "tokyo",
      duration: 90,
      id: "a",
    });
    expect(log).toEqual([
      { departureTime: 0, destinationId: "tokyo", duration: 90, id: "a" },
    ]);
  });

  test("summary counts departed flights only, newest first, partial minutes in flight", () => {
    const summary = getPassportSummary(
      [
        {
          departureTime: 10 * H,
          destinationId: "tokyo",
          duration: 120,
          id: "old",
        },
        {
          departureTime: 20 * H,
          destinationId: "osaka",
          duration: 60,
          id: "osaka",
        },
        { departureTime: now - 30 * 60_000, duration: 600, id: "now" },
        {
          departureTime: now + H,
          destinationId: "paris",
          duration: 60,
          id: "future",
        },
      ],
      now
    );
    expect(summary.stamps.map((s) => s.id)).toEqual(["now", "osaka", "old"]);
    expect(summary.flights).toBe(3);
    expect(summary.minutesInAir).toBe(120 + 60 + 30);
    expect(summary.cities).toBe(2);
    expect(summary.countries).toBe(1);
    expect(summary.stamps[0].city).toBeNull();
  });
});
