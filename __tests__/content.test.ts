import contentJson from "@/data/content.json";

type LocalizedText = Record<string, string>;
type ContentItem = {
	id: string;
	title: LocalizedText;
	category: LocalizedText;
	readTime: number;
	body: LocalizedText;
	image?: string;
};

const content = contentJson as unknown as ContentItem[];

describe("bundled content (data/content.json)", () => {
	test("is a non-empty array", () => {
		expect(Array.isArray(content)).toBe(true);
		expect(content.length).toBeGreaterThan(0);
	});

	test("every article has a unique id", () => {
		const ids = content.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test.each(content.map((a) => [a.id, a] as const))(
		"%s is well-formed and localized in en/cs/de",
		(_id, a) => {
			expect(typeof a.readTime).toBe("number");
			expect(a.readTime).toBeGreaterThan(0);
			for (const field of ["title", "category", "body"] as const) {
				const loc = a[field];
				expect(loc && typeof loc).toBe("object");
				for (const lang of ["en", "cs", "de"]) {
					expect(typeof loc[lang]).toBe("string");
					expect(loc[lang].trim().length).toBeGreaterThan(0);
				}
			}
			if (a.image !== undefined) {
				expect(typeof a.image).toBe("string");
			}
		},
	);
});

describe("article translations", () => {
	test("every present language has non-empty title, category and body", () => {
		for (const item of content) {
			for (const lang of Object.keys(item.title)) {
				expect(item.title[lang]?.trim().length ?? 0).toBeGreaterThan(0);
				expect(item.category[lang]?.trim().length ?? 0).toBeGreaterThan(0);
				expect(item.body[lang]?.trim().length ?? 0).toBeGreaterThan(0);
			}
		}
	});

	test("a category translates the same way across articles", () => {
		const seen = new Map<string, string>();
		for (const item of content) {
			for (const [lang, value] of Object.entries(item.category)) {
				const key = `${item.category.en}|${lang}`;
				const previous = seen.get(key);
				if (previous !== undefined) expect(value).toBe(previous);
				seen.set(key, value);
			}
		}
	});

	test("Travel Tips and Health are localized into the Latin-script languages", () => {
		const required = ["en", "cs", "de", "es", "fr", "it", "pl", "pt"];
		for (const item of content) {
			if (item.category.en !== "Travel Tips" && item.category.en !== "Health") continue;
			for (const lang of required) {
				expect(Object.keys(item.title)).toContain(lang);
				expect(Object.keys(item.body)).toContain(lang);
			}
		}
	});
});
