import { destinations, getDestinationById } from "@/data/destinations";

describe("destinations integrity", () => {
	test("every destination has a unique id", () => {
		const ids = destinations.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test.each(destinations.map((d) => [d.id, d] as const))(
		"%s is well-formed (city, country, emoji, tips)",
		(_id, d) => {
			expect(d.city.length).toBeGreaterThan(0);
			expect(d.country.length).toBeGreaterThan(0);
			expect(d.emoji.length).toBeGreaterThan(0);
			expect(d.tips.length).toBeGreaterThanOrEqual(3);
			for (const tip of d.tips) {
				expect(tip.icon.length).toBeGreaterThan(0);
				expect(tip.label.length).toBeGreaterThan(0);
				expect(tip.text.length).toBeGreaterThan(0);
			}
		},
	);

	test("getDestinationById resolves known ids and rejects unknown", () => {
		expect(getDestinationById(destinations[0].id)?.id).toBe(destinations[0].id);
		expect(getDestinationById("nowhere")).toBeUndefined();
	});
});
