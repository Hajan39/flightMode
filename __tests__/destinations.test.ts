import { currencies } from "@/data/currencies";
import { destinationNames } from "@/data/destinationNames";
import {
  destinations,
  getDestinationById,
  getDestinationCity,
  getDestinationCountry,
} from "@/data/destinations";
import { phraseLanguages } from "@/data/phrases";
import { en } from "@/i18n/locales/en";
import { supportedLanguages } from "@/i18n/translations";
import { getZoneOffsetMinutes } from "@/utils/timezone";

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
    }
  );

  test.each(destinations.map((d) => [d.id, d] as const))(
    "%s has valid timezone, offset, phrase language and currency",
    (_id, d) => {
      // Node ships full ICU, so an invalid IANA name throws here.
      expect(
        () => new Intl.DateTimeFormat("en", { timeZone: d.timezone })
      ).not.toThrow();
      expect(d.utcOffsetMinutes).toBeGreaterThanOrEqual(-720);
      expect(d.utcOffsetMinutes).toBeLessThanOrEqual(840);
      expect(Math.abs(d.utcOffsetMinutes % 15)).toBe(0);
      expect(phraseLanguages[d.phraseLanguage]?.code).toBe(d.phraseLanguage);
      expect(currencyCodes.has(d.currencyCode)).toBe(true);
      for (const key of d.checklistExtras ?? []) {
        expect(enKeys.has(key)).toBe(true);
      }
    }
  );

  test.each(destinations.map((d) => [d.id, d] as const))(
    "%s fallback utcOffsetMinutes equals the zone's standard (non-DST) offset",
    (_id, d) => {
      // Standard time = the smaller of the January / July offsets (DST adds).
      const jan = getZoneOffsetMinutes(Date.UTC(2026, 0, 15, 12), d);
      const jul = getZoneOffsetMinutes(Date.UTC(2026, 6, 15, 12), d);
      expect(d.utcOffsetMinutes).toBe(Math.min(jan, jul));
    }
  );

  test("getDestinationById resolves known ids and rejects unknown", () => {
    expect(getDestinationById(destinations[0].id)?.id).toBe(destinations[0].id);
    expect(getDestinationById("nowhere")).toBeUndefined();
  });
});

describe("localized destination names", () => {
  const languages = supportedLanguages.map((l) => l.code);
  const ids = destinations.map((d) => d.id).sort();

  test.each(languages)(
    "%s names every destination (city + country), nothing extra",
    (language) => {
      const table = destinationNames[language];
      expect(Object.keys(table).sort()).toEqual(ids);
      for (const d of destinations) {
        const [city, country] = table[d.id];
        expect(city.trim().length).toBeGreaterThan(0);
        expect(country.trim().length).toBeGreaterThan(0);
        expect(getDestinationCity(d, language)).toBe(city);
        expect(getDestinationCountry(d, language)).toBe(country);
      }
    }
  );

  test("English names match the source city/country fields", () => {
    for (const d of destinations) {
      expect(destinationNames.en[d.id]).toEqual([d.city, d.country]);
    }
  });

  test("uses established exonyms where they exist", () => {
    const tokyo = getDestinationById("tokyo");
    const vienna = getDestinationById("vienna");
    expect(tokyo && getDestinationCity(tokyo, "cs")).toBe("Tokio");
    expect(vienna && getDestinationCity(vienna, "de")).toBe("Wien");
  });
});
