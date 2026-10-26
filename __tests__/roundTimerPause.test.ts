/**
 * Per-round timers in Odd One Out and Color Clash run on wall-clock deadlines
 * (CLAUDE.md timer rule) and are pause-aware: a pause freezes the round and
 * its time bar, resume continues from the exact time left, and a tap that
 * lands after the deadline (timer not fired yet) can't beat the clock.
 */
import "./helpers/gameMocks";

import { StyleSheet } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";

import ColorClashGame from "@/games/color-clash";
import OddOneOutGame from "@/games/odd-one-out";

import { type Harness, mountGame } from "./helpers/gameHarness";

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-03-10T09:00:00Z") });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const SLASH_WS = /\s*\/\s*/g;
const WS = /\s+/;
const SCORE_ZERO = /oddScore\s*0/;

/** Presses the first control with this label (pause buttons are excluded
 *  from the harness' own press helpers); false when there is none. */
const pressLabel = (h: Harness, label: string) => {
  const [node] = h.r.root.findAll(
    (n) =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === "function"
  );
  if (!node) {
    return false;
  }
  act(() => node.props.onPress());
  return true;
};

/** Width (in %) of the odd-one-out time bar fill. */
const timeBarPct = (h: Harness) => {
  const fills = h.r.root.findAll((n: ReactTestInstance) => {
    const style = StyleSheet.flatten(n.props.style);
    return (
      typeof n.type === "string" &&
      style?.height === "100%" &&
      typeof style.width === "string" &&
      style.width.endsWith("%")
    );
  });
  return fills.length === 1
    ? Number.parseFloat(StyleSheet.flatten(fills[0].props.style).width)
    : Number.NaN;
};

/** True when the header shows "round/total" (as one token, "1 / 20" too). */
const roundIs = (h: Harness, round: number, total: number) =>
  h.screen().replace(SLASH_WS, "/").split(WS).includes(`${round}/${total}`);

describe("odd-one-out", () => {
  test("pause freezes the round; resume continues from the time left", async () => {
    const h = mountGame(OddOneOutGame);
    try {
      expect(h.press("gameTapToStart")).toBe(true);
      // Round 1 lasts 6000 ms.
      await h.advance(2000, 100);
      expect(pressLabel(h, "gamePause")).toBe(true);
      expect(h.screen()).toContain("gameResume");
      const frozen = timeBarPct(h);
      // Animated.timing eases in/out, so not exactly 2/3 — just mid-way.
      expect(frozen).toBeGreaterThan(50);
      expect(frozen).toBeLessThan(90);

      await h.advance(60_000, 1000);
      expect(h.screen()).not.toContain("oddTimeUp");
      expect(roundIs(h, 1, 15)).toBe(true);
      expect(timeBarPct(h)).toBeCloseTo(frozen, 0);
      expect(h.calls).toHaveLength(0);

      expect(pressLabel(h, "gameResume")).toBe(true);
      await h.advance(3800, 100);
      expect(h.screen()).not.toContain("oddTimeUp");
      expect(timeBarPct(h)).toBeLessThan(frozen);
      await h.advance(300, 100);
      expect(h.screen()).toContain("oddTimeUp");
    } finally {
      h.unmount();
    }
  });

  test("a tap after the deadline counts as time up, not a point", async () => {
    const h = mountGame(OddOneOutGame);
    try {
      expect(h.press("gameTapToStart")).toBe(true);
      await h.advance(500, 100);
      // Find the odd emoji (the one that appears once).
      const cells = h.r.root.findAll(
        (n) =>
          typeof n.props.onPress === "function" &&
          n.props.accessibilityRole === undefined &&
          n.props.accessibilityLabel === undefined
      );
      expect(cells.length).toBeGreaterThan(0);
      const texts = cells.map((c) =>
        c
          .findAll((x) => typeof x.children[0] === "string")
          .map((x) => x.children[0])
          .join("")
      );
      const odd = texts.findIndex(
        (t) => texts.filter((u) => u === t).length === 1
      );
      expect(odd).toBeGreaterThanOrEqual(0);

      // The clock passes the deadline but the timer hasn't fired yet.
      jest.setSystemTime(Date.now() + 10_000);
      act(() => cells[odd].props.onPress());
      expect(h.screen()).toContain("oddTimeUp");
      expect(h.screen()).toMatch(SCORE_ZERO);
    } finally {
      h.unmount();
    }
  });
});

describe("color-clash", () => {
  test("pause freezes the round; resume continues from the time left", async () => {
    const h = mountGame(ColorClashGame);
    try {
      expect(h.press("gameTapToStart")).toBe(true);
      // Round lasts 1800 ms.
      await h.advance(1000, 100);
      expect(pressLabel(h, "gamePause")).toBe(true);
      await h.advance(30_000, 1000);
      expect(roundIs(h, 1, 20)).toBe(true);
      expect(h.calls).toHaveLength(0);

      expect(pressLabel(h, "gameResume")).toBe(true);
      // 800 ms left: still round 1 just before it, round 2 after the
      // deadline + the 350 ms feedback flash.
      await h.advance(700, 50);
      expect(roundIs(h, 1, 20)).toBe(true);
      await h.advance(600, 50);
      expect(roundIs(h, 2, 20)).toBe(true);
    } finally {
      h.unmount();
    }
  });

  test("a pause during the feedback flash keeps its remaining time", async () => {
    const h = mountGame(ColorClashGame);
    try {
      expect(h.press("gameTapToStart")).toBe(true);
      // Let round 1 time out (1800 ms), then pause inside the 350 ms flash.
      await h.advance(1900, 50);
      expect(pressLabel(h, "gamePause")).toBe(true);
      await h.advance(10_000, 1000);
      expect(roundIs(h, 1, 20)).toBe(true);
      expect(pressLabel(h, "gameResume")).toBe(true);
      await h.advance(400, 50);
      expect(roundIs(h, 2, 20)).toBe(true);
    } finally {
      h.unmount();
    }
  });
});
