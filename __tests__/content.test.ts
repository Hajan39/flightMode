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
