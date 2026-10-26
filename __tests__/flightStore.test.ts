import {
  getElapsedMinutes,
  getFlightProgress,
  getRemainingMinutes,
  useFlightStore,
} from "@/store/useFlightStore";
import type { Flight } from "@/types/flight";

const NOW = Date.UTC(2026, 0, 15, 12, 0);
const MIN = 60_000;

function flightAt(offsetMin: number, duration: number): Flight {
  return { departureTime: NOW + offsetMin * MIN, duration, id: "f" };
}

describe("flight time helpers", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  test("before departure nothing has elapsed and the whole flight remains", () => {
    const f = flightAt(30, 120);
    expect(getElapsedMinutes(f)).toBe(0);
    expect(getRemainingMinutes(f)).toBe(120);
    expect(getFlightProgress(f)).toBe(0);
  });

  test("mid-flight reports elapsed, remaining and progress", () => {
    const f = flightAt(-30, 120);
    expect(getElapsedMinutes(f)).toBe(30);
    expect(getRemainingMinutes(f)).toBe(90);
    expect(getFlightProgress(f)).toBeCloseTo(0.25);
  });

  test("after landing elapsed is capped at the duration", () => {
    const f = flightAt(-500, 120);
    expect(getElapsedMinutes(f)).toBe(120);
    expect(getRemainingMinutes(f)).toBe(0);
    expect(getFlightProgress(f)).toBe(1);
  });

  test("a zero-length flight never divides by zero", () => {
    const f = flightAt(-10, 0);
    expect(getFlightProgress(f)).toBe(0);
    expect(getRemainingMinutes(f)).toBe(0);
  });
});

describe("useFlightStore passport log", () => {
  beforeEach(() => useFlightStore.setState({ flight: null, log: [] }));

  test("setFlight logs the flight; editing it upserts instead of duplicating", () => {
    const { setFlight } = useFlightStore.getState();
    setFlight({ departureTime: NOW, duration: 60, id: "a" });
    setFlight({
      departureTime: NOW,
      destinationId: "tokyo",
      duration: 90,
      id: "a",
    });
    setFlight({ departureTime: NOW + MIN, duration: 30, id: "b" });
    const { flight, log } = useFlightStore.getState();
    expect(flight?.id).toBe("b");
    expect(log.map((f) => [f.id, f.duration])).toEqual([
      ["a", 90],
      ["b", 30],
    ]);
  });

  test("clearFlight removes the active flight but keeps the passport", () => {
    useFlightStore
      .getState()
      .setFlight({ departureTime: NOW, duration: 60, id: "a" });
    useFlightStore.getState().clearFlight();
    expect(useFlightStore.getState().flight).toBeNull();
    expect(useFlightStore.getState().log).toHaveLength(1);
  });

  test("v0 → v1 migration seeds the passport with the saved flight", () => {
    const { migrate } = useFlightStore.persist.getOptions();
    if (!migrate) {
      throw new Error("useFlightStore must define a migrate step");
    }
    const flight: Flight = { departureTime: NOW, duration: 60, id: "old" };
    const migrated = migrate({ flight }, 0) as { log: Flight[] };
    expect(migrated.log).toEqual([flight]);
    const empty = migrate({ flight: null }, 0) as { log: Flight[] };
    expect(empty.log).toEqual([]);
  });
});
