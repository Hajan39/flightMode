/**
 * WCAG contrast for the semantic status tokens in constants/Colors.ts and the
 * game color sets that live there (minesweeper numbers, 2048 tiles). Every
 * palette — including the Plus themes — must keep these readable.
 */
import { baseScheme, type ResolvedScheme } from "@/components/colorSchemes";
import Colors, {
  MineNumberColors,
  OnPlayerColor,
  PlayerColors,
  Tile2048Colors,
  Tile2048High,
} from "@/constants/Colors";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.039_28 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;

const schemes = Object.keys(Colors) as ResolvedScheme[];
const SURFACES = ["background", "card", "surface", "elevated"] as const;
const TEXT_TOKENS = ["success", "danger", "info", "warningText"] as const;
const FILL_PAIRS = [
  ["success", "onSuccess"],
  ["danger", "onDanger"],
  ["warning", "onWarning"],
] as const;

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });
});

describe("theme palettes", () => {
  it("covers the free and Plus schemes with identical keys", () => {
    expect(schemes.sort()).toEqual([
      "crazy",
      "dark",
      "light",
      "midnight",
      "sunset",
    ]);
    const keys = Object.keys(Colors.light).sort();
    for (const scheme of schemes) {
      expect(Object.keys(Colors[scheme]).sort()).toEqual(keys);
    }
  });

  it.each(schemes)("%s: semantic tokens are 6-digit hex", (scheme) => {
    const p = Colors[scheme];
    for (const key of [...TEXT_TOKENS, "warning", "onSuccess", "onDanger"]) {
      expect(p[key as keyof typeof p]).toMatch(HEX_RE);
    }
    expect(p.onWarning).toMatch(HEX_RE);
  });

  it.each(schemes)("%s: status text reads on every surface (AA)", (scheme) => {
    const p = Colors[scheme];
    const failures = TEXT_TOKENS.flatMap((fg) =>
      SURFACES.filter((bg) => contrast(p[fg], p[bg]) < AA_TEXT).map(
        (bg) => `${fg} on ${bg}: ${contrast(p[fg], p[bg]).toFixed(2)}`
      )
    );
    expect(failures).toEqual([]);
  });

  it.each(schemes)("%s: text on status fills is AA", (scheme) => {
    const p = Colors[scheme];
    const failures = FILL_PAIRS.filter(
      ([fill, ink]) => contrast(p[ink], p[fill]) < AA_TEXT
    ).map(([fill, ink]) => `${ink} on ${fill}`);
    expect(failures).toEqual([]);
  });
});

describe("game color sets", () => {
  it("dark ink reads on every seat color (AA)", () => {
    for (const seat of PlayerColors) {
      expect(contrast(OnPlayerColor, seat)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it.each(schemes)("%s: minesweeper numbers read on the board", (scheme) => {
    const numbers = MineNumberColors[baseScheme(scheme)];
    expect(numbers).toHaveLength(8);
    const bg = Colors[scheme].background;
    expect(numbers.filter((c) => contrast(c, bg) < AA_TEXT)).toEqual([]);
  });

  it("2048 numerals read on their tiles (large bold text)", () => {
    const tiles = [...Object.values(Tile2048Colors), Tile2048High];
    const failures = tiles
      .filter(([bg, fg]) => contrast(fg, bg) < AA_LARGE)
      .map(([bg]) => bg);
    expect(failures).toEqual([]);
  });
});
