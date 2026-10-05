import { getPassportSummary, upsertLoggedFlight } from "@/utils/passport";

const H = 3600_000;
const now = 100 * H;

describe("flight passport", () => {
	test("upsert replaces an edited flight instead of adding a second stamp", () => {
		let log = upsertLoggedFlight([], { id: "a", departureTime: 0, duration: 60 });
		log = upsertLoggedFlight(log, { id: "a", departureTime: 0, duration: 90, destinationId: "tokyo" });
		expect(log).toEqual([{ id: "a", departureTime: 0, duration: 90, destinationId: "tokyo" }]);
	});

	test("summary counts departed flights only, newest first, partial minutes in flight", () => {
		const summary = getPassportSummary(
			[
				{ id: "old", departureTime: 10 * H, duration: 120, destinationId: "tokyo" },
				{ id: "osaka", departureTime: 20 * H, duration: 60, destinationId: "osaka" },
				{ id: "now", departureTime: now - 30 * 60_000, duration: 600 },
				{ id: "future", departureTime: now + H, duration: 60, destinationId: "paris" },
			],
			now,
		);
		expect(summary.stamps.map((s) => s.id)).toEqual(["now", "osaka", "old"]);
		expect(summary.flights).toBe(3);
		expect(summary.minutesInAir).toBe(120 + 60 + 30);
		expect(summary.cities).toBe(2);
		expect(summary.countries).toBe(1);
		expect(summary.stamps[0].city).toBeNull();
	});
});
