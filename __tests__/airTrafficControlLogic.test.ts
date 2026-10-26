import {
  type Flight,
  resolveAssignment,
  tickFlights,
} from "@/games/air-traffic-control/logic";

const NOW = 1_000_000;

function flight(id: number, runway: Flight["runway"], secs: number): Flight {
  return {
    callsign: `FM-${id}`,
    expiresAt: NOW + secs * 1000,
    fuel: secs,
    id,
    maxFuel: secs,
    runway,
  };
}

describe("air-traffic-control resolveAssignment", () => {
  const queue = [flight(1, "A", 5), flight(2, "B", 8)];

  test("correct runway lands and scores (every time, not just the first)", () => {
    const first = resolveAssignment(queue, 1, "A", 1, NOW);
    expect(first).toEqual({
      flights: [queue[1]],
      kind: "landed",
      points: 18 + 5 * 3 + 1 * 2,
    });
    // Second landing on the already-updated queue must also score.
    const second = resolveAssignment(first.flights, 2, "B", 2, NOW);
    expect(second.kind).toBe("landed");
    expect(second.kind === "landed" && second.points).toBe(18 + 8 * 3 + 4);
    expect(second.flights).toEqual([]);
  });

  test("wrong runway removes the flight and reports a miss", () => {
    const out = resolveAssignment(queue, 2, "C", 1, NOW);
    expect(out.kind).toBe("wrong");
    expect(out.flights.map((f) => f.id)).toEqual([1]);
  });

  test("unknown / already-resolved flight is a no-op", () => {
    const out = resolveAssignment(queue, 99, "A", 1, NOW);
    expect(out.kind).toBe("none");
    expect(out.flights).toBe(queue);
  });

  test("does not mutate the input queue", () => {
    const copy = [...queue];
    resolveAssignment(queue, 1, "A", 1, NOW);
    expect(queue).toEqual(copy);
  });
});

describe("air-traffic-control tickFlights", () => {
  test("unchanged fuel keeps the same array", () => {
    const queue = [flight(1, "A", 5)];
    const out = tickFlights(queue, NOW);
    expect(out).toEqual({ changed: false, flights: queue, lost: 0 });
    expect(out.flights).toBe(queue);
  });

  test("burns fuel and counts expired flights", () => {
    const queue = [flight(1, "A", 1), flight(2, "B", 4)];
    const out = tickFlights(queue, NOW + 1500);
    expect(out.lost).toBe(1);
    expect(out.changed).toBe(true);
    expect(out.flights).toEqual([{ ...queue[1], fuel: 3 }]);
  });
});
