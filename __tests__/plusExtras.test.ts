import contentJson from "@/data/content.json";
import { en } from "@/i18n/locales/en";
import type { ContentItem } from "@/types/content";
import {
  BREATH_PATTERNS,
  BREATH_PHASE_LABEL_KEY,
  BREATH_PHASE_SCALE,
  canUseBreathPattern,
  DEFAULT_BREATH_PATTERN_ID,
  getBreathPattern,
  getBreathPosition,
  getCycleMs,
} from "@/utils/breathing";
import { isContentItem, parseContentFeed } from "@/utils/contentSync";
import {
  canReadFullArticle,
  getArticlePreview,
  getVisibleParagraphs,
  isPlusContent,
  splitArticleParagraphs,
} from "@/utils/plusContent";

const content = contentJson as unknown as ContentItem[];
const WHITESPACE = /\s+/;
const HTTPS_URL = /^https:\/\//;
const DOCTOR: Record<"cs" | "de" | "en", RegExp> = {
  cs: /lékař/,
  de: /Ärzt|Arzt/,
  en: /doctor/,
};
const enKeys = new Set(Object.keys(en));

/** Phase durations (seconds) of a pattern, in order. */
const secondsOf = (id: string) =>
  getBreathPattern(id).phases.map((p) => [p.kind, p.seconds]);

describe("breathing patterns", () => {
  test("box breathing is free, the default and unchanged (4-4-4-4)", () => {
    const box = getBreathPattern("box");
    expect(DEFAULT_BREATH_PATTERN_ID).toBe("box");
    expect(box.plus).toBe(false);
    expect(box.analyticsId).toBe("box_breathing");
    expect(secondsOf("box")).toEqual([
      ["in", 4],
      ["hold", 4],
      ["out", 4],
      ["hold", 4],
    ]);
    expect(getCycleMs(box)).toBe(16_000);
  });

  test("Plus pattern timing tables are exact", () => {
    expect(secondsOf("sleep-478")).toEqual([
      ["in", 4],
      ["hold", 7],
      ["out", 8],
    ]);
    expect(secondsOf("coherent")).toEqual([
      ["in", 5.5],
      ["out", 5.5],
    ]);
    expect(secondsOf("sigh")).toEqual([
      ["in", 2],
      ["inTop", 1],
      ["out", 6],
    ]);
    expect(secondsOf("turbulence")).toEqual([
      ["in", 4],
      ["out", 6],
    ]);
    expect(getCycleMs(getBreathPattern("sleep-478"))).toBe(19_000);
    expect(getCycleMs(getBreathPattern("coherent"))).toBe(11_000);
    expect(getCycleMs(getBreathPattern("sigh"))).toBe(9000);
    expect(getCycleMs(getBreathPattern("turbulence"))).toBe(10_000);
  });

  test("exactly the four new patterns are Plus, every pattern has unique ids", () => {
    expect(BREATH_PATTERNS.filter((p) => p.plus).map((p) => p.id)).toEqual([
      "sleep-478",
      "coherent",
      "sigh",
      "turbulence",
    ]);
    expect(new Set(BREATH_PATTERNS.map((p) => p.id)).size).toBe(
      BREATH_PATTERNS.length
    );
    expect(new Set(BREATH_PATTERNS.map((p) => p.analyticsId)).size).toBe(
      BREATH_PATTERNS.length
    );
  });

  test("every pattern starts with an inhale, ends with an exhale or hold and has translated labels", () => {
    for (const pattern of BREATH_PATTERNS) {
      expect(pattern.phases[0]?.kind).toBe("in");
      expect(pattern.phases.some((p) => p.kind === "out")).toBe(true);
      for (const phase of pattern.phases) {
        expect(phase.seconds).toBeGreaterThan(0);
        expect(enKeys.has(BREATH_PHASE_LABEL_KEY[phase.kind])).toBe(true);
      }
      expect(enKeys.has(pattern.nameKey)).toBe(true);
      expect(enKeys.has(pattern.descriptionKey)).toBe(true);
    }
  });

  test("animation scales: inhale grows, top-up grows more, exhale returns, hold keeps", () => {
    expect(BREATH_PHASE_SCALE.in).toBeGreaterThan(1);
    expect(BREATH_PHASE_SCALE.inTop).toBeGreaterThan(
      BREATH_PHASE_SCALE.in as number
    );
    expect(BREATH_PHASE_SCALE.out).toBe(1);
    expect(BREATH_PHASE_SCALE.hold).toBeNull();
  });

  test("getBreathPosition follows the wall clock through phases and cycles", () => {
    const p478 = getBreathPattern("sleep-478");
    expect(getBreathPosition(p478, 0)).toEqual({
      cycle: 0,
      phaseIndex: 0,
      remainingMs: 4000,
      secondsLeft: 4,
    });
    expect(getBreathPosition(p478, 3999).phaseIndex).toBe(0);
    expect(getBreathPosition(p478, 4000)).toMatchObject({
      phaseIndex: 1,
      secondsLeft: 7,
    });
    expect(getBreathPosition(p478, 10_999).phaseIndex).toBe(1);
    expect(getBreathPosition(p478, 11_000)).toMatchObject({
      phaseIndex: 2,
      secondsLeft: 8,
    });
    expect(getBreathPosition(p478, 19_000)).toMatchObject({
      cycle: 1,
      phaseIndex: 0,
    });
    // A skipped tick (e.g. app paused 1 min) lands on the right phase.
    expect(getBreathPosition(p478, 60_000 + 19_000 * 3)).toMatchObject({
      cycle: 6,
      phaseIndex: 0,
      remainingMs: 1000,
    });
  });

  test("half-second phases round the shown seconds up", () => {
    const coherent = getBreathPattern("coherent");
    expect(getBreathPosition(coherent, 0).secondsLeft).toBe(6);
    expect(getBreathPosition(coherent, 5000)).toMatchObject({
      phaseIndex: 0,
      remainingMs: 500,
      secondsLeft: 1,
    });
    expect(getBreathPosition(coherent, 5500)).toMatchObject({
      phaseIndex: 1,
      secondsLeft: 6,
    });
    expect(getBreathPosition(coherent, -50).phaseIndex).toBe(0);
  });

  test("Plus patterns need Plus; box breathing never does", () => {
    for (const pattern of BREATH_PATTERNS) {
      expect(canUseBreathPattern(pattern, true)).toBe(true);
      expect(canUseBreathPattern(pattern, false)).toBe(!pattern.plus);
    }
    expect(getBreathPattern("unknown").id).toBe("box");
  });
});

describe("Plus article gating", () => {
  const free = { plus: undefined };
  const plusItem = { plus: true };

  test("free content is always fully readable", () => {
    expect(canReadFullArticle(free, false)).toBe(true);
    expect(canReadFullArticle(free, true)).toBe(true);
    expect(canReadFullArticle({ plus: false }, false)).toBe(true);
    expect(isPlusContent(free)).toBe(false);
  });

  test("Plus content is fully readable only with Plus", () => {
    expect(isPlusContent(plusItem)).toBe(true);
    expect(canReadFullArticle(plusItem, false)).toBe(false);
    expect(canReadFullArticle(plusItem, true)).toBe(true);
  });

  test("the preview is the intro paragraph, the full text needs Plus", () => {
    const body =
      "Intro one.\n\n**Heading**\n- bullet\nSecond paragraph.\n  \nThird.";
    expect(splitArticleParagraphs(body)).toEqual([
      "Intro one.",
      "**Heading**",
      "- bullet",
      "Second paragraph.",
      "Third.",
    ]);
    expect(getVisibleParagraphs(plusItem, body, false)).toEqual(["Intro one."]);
    expect(getVisibleParagraphs(plusItem, body, true)).toHaveLength(5);
    expect(getVisibleParagraphs(free, body, false)).toHaveLength(5);
    // A body starting with a heading keeps it and stops after the first text.
    expect(getArticlePreview(["**H**", "Text", "More"])).toEqual([
      "**H**",
      "Text",
    ]);
    expect(getArticlePreview(["**Only heading**"])).toEqual([
      "**Only heading**",
    ]);
  });

  test("the bundled set has exactly six Plus guides and the free ones stay free", () => {
    const plusIds = content.filter(isPlusContent).map((a) => a.id);
    expect(plusIds).toEqual([
      "plus-long-haul-sleep",
      "plus-jet-lag-plan",
      "plus-turbulence-explained",
      "plus-long-layover",
      "plus-flying-with-kids",
      "plus-cabin-comfort",
    ]);
    // Every article that existed before Plus guides stays free.
    const freeArticles = content.filter((a) => !isPlusContent(a));
    expect(freeArticles.length).toBeGreaterThanOrEqual(44);
    for (const id of ["jet-lag", "sleep-on-plane", "airplane-exercises"]) {
      expect(freeArticles.map((a) => a.id)).toContain(id);
    }
  });

  test.each(content.filter(isPlusContent).map((a) => [a.id, a] as const))(
    "%s is complete in en/cs/de, cites sources and has a teaser",
    (_id, a) => {
      expect(isContentItem(a)).toBe(true);
      for (const lang of ["en", "cs", "de"] as const) {
        const body = a.body[lang] ?? "";
        expect(body.split(WHITESPACE).length).toBeGreaterThan(500);
        const preview = getVisibleParagraphs(a, body, false);
        expect(preview).toHaveLength(1);
        expect(preview[0]?.length).toBeGreaterThan(120);
        expect(splitArticleParagraphs(body).length).toBeGreaterThan(10);
      }
      expect(a.sources?.length).toBeGreaterThanOrEqual(2);
      for (const source of a.sources ?? []) {
        expect(source.url).toMatch(HTTPS_URL);
        expect(source.title.trim().length).toBeGreaterThan(0);
      }
    }
  );

  test("health guides tell the reader to ask a doctor", () => {
    for (const a of content.filter(
      (item) => isPlusContent(item) && item.category.en !== "Travel Tips"
    )) {
      for (const lang of ["en", "cs", "de"] as const) {
        expect(a.body[lang]).toMatch(DOCTOR[lang]);
      }
    }
  });
});

describe("content validation: plus + sources", () => {
  const valid = {
    body: { en: "Body" },
    category: { en: "Travel Tips" },
    id: "ok",
    readTime: 3,
    title: { en: "Title" },
  };

  test("a feed item without `plus` is valid and free", () => {
    expect(isContentItem(valid)).toBe(true);
    expect(isPlusContent(valid)).toBe(false);
  });

  test("plus must be a boolean, sources a list of {title, url}", () => {
    expect(isContentItem({ ...valid, plus: true })).toBe(true);
    expect(isContentItem({ ...valid, plus: false })).toBe(true);
    expect(isContentItem({ ...valid, plus: "yes" })).toBe(false);
    expect(isContentItem({ ...valid, plus: 1 })).toBe(false);
    expect(
      isContentItem({ ...valid, sources: [{ title: "T", url: "https://x" }] })
    ).toBe(true);
    expect(isContentItem({ ...valid, sources: [] })).toBe(true);
    expect(isContentItem({ ...valid, sources: "https://x" })).toBe(false);
    expect(isContentItem({ ...valid, sources: [{ title: "T" }] })).toBe(false);
  });

  test("the feed parser keeps valid Plus items and drops malformed ones", () => {
    const parsed = parseContentFeed(
      {
        items: [
          valid,
          { ...valid, id: "p", plus: true },
          { ...valid, id: "bad", plus: "true" },
        ],
        version: "v9",
      },
      null
    );
    expect(parsed?.items.map((i) => [i.id, isPlusContent(i)])).toEqual([
      ["ok", false],
      ["p", true],
    ]);
  });
});
