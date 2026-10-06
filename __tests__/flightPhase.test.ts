import type { Flight } from "@/types/flight";
import { getFlightPhase, LANDED_WINDOW_MS } from "@/utils/flightPhase";

const HOUR = 3_600_000;
const departureTime = Date.UTC(2026, 0, 15, 10, 0);
const flight: Flight = {
  departureTime,
  destinationId: "tokyo",
  duration: 600, // 10 h
  id: "f1",
};
const arrival = departureTime + 600 * 60_000;

describe("getFlightPhase", () => {
  test("no flight → none", () => {
    expect(getFlightPhase(null, departureTime)).toBe("none");
    expect(getFlightPhase(undefined, departureTime)).toBe("none");
  });

  test("before departure → preflight", () => {
    expect(getFlightPhase(flight, departureTime - HOUR)).toBe("preflight");
    expect(getFlightPhase(flight, departureTime - 1)).toBe("preflight");
  });

  test("between departure and arrival → inflight", () => {
    expect(getFlightPhase(flight, departureTime)).toBe("inflight");
    expect(getFlightPhase(flight, arrival - 1)).toBe("inflight");
  });

  test("just after arrival → landed, for 48 h", () => {
    expect(getFlightPhase(flight, arrival)).toBe("landed");
    expect(getFlightPhase(flight, arrival + 47 * HOUR)).toBe("landed");
    expect(getFlightPhase(flight, arrival + LANDED_WINDOW_MS - 1)).toBe(
      "landed"
    );
  });

  test("more than 48 h after arrival → none (stale flight)", () => {
    expect(getFlightPhase(flight, arrival + LANDED_WINDOW_MS)).toBe("none");
    expect(getFlightPhase(flight, arrival + 10 * 24 * HOUR)).toBe("none");
  });
});
