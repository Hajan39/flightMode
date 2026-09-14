import { currencies } from "@/data/currencies";
import { destinations, getDestinationById } from "@/data/destinations";
import { phraseLanguages } from "@/data/phrases";
import { en } from "@/i18n/locales/en";

const enKeys = new Set(Object.keys(en));
const currencyCodes = new Set(currencies.map((c) => c.code));

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
				expect(enKeys.has(tip.labelKey)).toBe(true);
				expect(tip.text.length).toBeGreaterThan(0);
			}
		},
	);

	test.each(destinations.map((d) => [d.id, d] as const))(
		"%s has valid timezone, offset, phrase language and currency",
		(_id, d) => {
			// Node ships full ICU, so an invalid IANA name throws here.
			expect(
				() => new Intl.DateTimeFormat("en", { timeZone: d.timezone }),
			).not.toThrow();
			expect(d.utcOffsetMinutes).toBeGreaterThanOrEqual(-720);
			expect(d.utcOffsetMinutes).toBeLessThanOrEqual(840);
			expect(Math.abs(d.utcOffsetMinutes % 15)).toBe(0);
			expect(phraseLanguages[d.phraseLanguage]).toBeDefined();
			expect(currencyCodes.has(d.currencyCode)).toBe(true);
			for (const key of d.checklistExtras ?? []) {
				expect(enKeys.has(key)).toBe(true);
			}
		},
	);

	test("getDestinationById resolves known ids and rejects unknown", () => {
		expect(getDestinationById(destinations[0].id)?.id).toBe(destinations[0].id);
		expect(getDestinationById("nowhere")).toBeUndefined();
	});
});
