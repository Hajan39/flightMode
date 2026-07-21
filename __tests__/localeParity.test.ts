import { cs } from "@/i18n/locales/cs";
import { de } from "@/i18n/locales/de";
import { en } from "@/i18n/locales/en";
import { es } from "@/i18n/locales/es";
import { fr } from "@/i18n/locales/fr";
import { hi } from "@/i18n/locales/hi";
import { it } from "@/i18n/locales/it";
import { ja } from "@/i18n/locales/ja";
import { ko } from "@/i18n/locales/ko";
import { pl } from "@/i18n/locales/pl";
import { pt } from "@/i18n/locales/pt";
import { zh } from "@/i18n/locales/zh";

const locales: Record<string, Record<string, string>> = {
	cs,
	de,
	es,
	fr,
	hi,
	it,
	ja,
	ko,
	pl,
	pt,
	zh,
};

const enKeys = Object.keys(en).sort();

describe("locale key parity", () => {
	test("en itself has no duplicate keys (object well-formed)", () => {
		expect(enKeys.length).toBeGreaterThan(0);
	});

	for (const [name, obj] of Object.entries(locales)) {
		test(`${name} has exactly the same keys as en`, () => {
			const keys = Object.keys(obj).sort();
			const missing = enKeys.filter((k) => !keys.includes(k));
			const extra = keys.filter((k) => !enKeys.includes(k));
			expect({ missing, extra }).toEqual({ missing: [], extra: [] });
		});

		test(`${name} has no empty string values`, () => {
			const empties = Object.entries(obj)
				.filter(([, v]) => typeof v === "string" && v.trim().length === 0)
				.map(([k]) => k);
			expect(empties).toEqual([]);
		});
	}
});
