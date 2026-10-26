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

  test("an explicit nowMs wins over the system clock (render code passes the Home tick)", () => {
    const f = flightAt(-30, 120);
    const later = NOW + 60 * MIN;
    expect(getElapsedMinutes(f, later)).toBe(90);
    expect(getRemainingMinutes(f, later)).toBe(30);
    expect(getFlightProgress(f, later)).toBeCloseTo(0.75);
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

describe("useFlightStore home offset", () => {
  beforeEach(() => useFlightStore.setState({ flight: null, log: [] }));
  afterEach(() => jest.restoreAllMocks());

  const mockDeviceOffset = (minutes: number) =>
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-minutes);

  test("saving a flight captures the device offset; the passport log omits it", () => {
    mockDeviceOffset(60);
    useFlightStore
      .getState()
      .setFlight({ departureTime: NOW, duration: 60, id: "a" });
    expect(useFlightStore.getState().flight?.homeOffsetMinutes).toBe(60);
    expect(useFlightStore.getState().log[0]).not.toHaveProperty(
      "homeOffsetMinutes"
    );
  });

  test("editing without moving the departure keeps the original home offset", () => {
    mockDeviceOffset(60);
    const { setFlight } = useFlightStore.getState();
    setFlight({ departureTime: NOW, duration: 60, id: "a" });
    // Phone has switched to the destination zone (Tokyo).
    jest.restoreAllMocks();
    mockDeviceOffset(540);
    setFlight({ departureTime: NOW, duration: 90, id: "a" });
    expect(useFlightStore.getState().flight?.homeOffsetMinutes).toBe(60);
  });

  test("a moved departure or a new flight re-captures; an explicit value wins", () => {
    mockDeviceOffset(60);
    const { setFlight } = useFlightStore.getState();
    setFlight({ departureTime: NOW, duration: 60, id: "a" });
    jest.restoreAllMocks();
    mockDeviceOffset(-300);
    setFlight({ departureTime: NOW + MIN, duration: 60, id: "a" });
    expect(useFlightStore.getState().flight?.homeOffsetMinutes).toBe(-300);
    setFlight({ departureTime: NOW + MIN, duration: 60, id: "b" });
    expect(useFlightStore.getState().flight?.homeOffsetMinutes).toBe(-300);
    setFlight({
      departureTime: NOW + MIN,
      duration: 60,
      homeOffsetMinutes: 330,
      id: "b",
    });
    expect(useFlightStore.getState().flight?.homeOffsetMinutes).toBe(330);
  });

  test("a persisted flight without the field still rehydrates (v1, no migration)", () => {
    const { migrate } = useFlightStore.persist.getOptions();
    const legacy = {
      flight: { departureTime: NOW, duration: 60, id: "old" },
      log: [],
    };
    expect(migrate?.(legacy, 1)).toEqual(legacy);
    expect(useFlightStore.persist.getOptions().version).toBe(1);
  });
});
