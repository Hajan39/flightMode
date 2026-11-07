import { NONOGRAM_LEVELS } from "@/games/nonogram/levels";
import { LEVELS as JAM_LEVELS } from "@/games/runway-jam/levels";
import { LEVELS as SUN_MOON_LEVELS } from "@/games/sun-moon/levels";
import {
  canPlayLevel,
  type GatedLevel,
  isPlusLevel,
  levelTapAction,
} from "@/utils/plusLevels";

const PACKS: [string, GatedLevel[], number, number][] = [
  // [game, levels, free count, Plus count]
  ["runway-jam", JAM_LEVELS, 18, 12],
  ["nonogram", NONOGRAM_LEVELS, 15, 10],
  ["sun-moon", SUN_MOON_LEVELS, 16, 10],
];

describe("plus level gating (pure)", () => {
  test("free levels are always playable", () => {
    for (const level of [{}, { plus: false }] as GatedLevel[]) {
      expect(isPlusLevel(level)).toBe(false);
      expect(canPlayLevel(level, false)).toBe(true);
      expect(canPlayLevel(level, true)).toBe(true);
      expect(levelTapAction(level, false)).toBe("play");
      expect(levelTapAction(level, true)).toBe("play");
    }
  });

  test("Plus levels are playable only with Plus; otherwise they upsell", () => {
    const level: GatedLevel = { plus: true };
    expect(isPlusLevel(level)).toBe(true);
    expect(canPlayLevel(level, false)).toBe(false);
    expect(canPlayLevel(level, true)).toBe(true);
    expect(levelTapAction(level, false)).toBe("upsell");
    expect(levelTapAction(level, true)).toBe("play");
  });
});

describe.each(PACKS)("%s Plus pack", (_game, levels, freeCount, plusCount) => {
  test("the free levels stay free (nothing free today is gated)", () => {
    const free = levels.slice(0, freeCount);
    expect(free.every((level) => !isPlusLevel(level))).toBe(true);
    expect(free.every((level) => canPlayLevel(level, false))).toBe(true);
  });

  test("the Plus levels are appended after the free ones", () => {
    expect(levels).toHaveLength(freeCount + plusCount);
    const pack = levels.slice(freeCount);
    expect(pack.every(isPlusLevel)).toBe(true);
    expect(pack.some((level) => canPlayLevel(level, false))).toBe(false);
    expect(pack.every((level) => canPlayLevel(level, true))).toBe(true);
  });
});
