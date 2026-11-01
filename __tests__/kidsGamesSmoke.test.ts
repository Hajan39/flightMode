/**
 * Render smoke test for every kids-mode game variant (`data/kidsGames.ts`)
 * plus the parent lock and the kids home. Same harness as the all-games
 * smoke suite (real shared UI, only native modules mocked). Each variant
 * must mount, start straight away (no rules / countdown), make visible
 * progress, reach the celebration (▶ again / 🏠 home) — and record NOTHING:
 * updateProgress is never called and the parent's stats stay untouched.
 */
import "./helpers/gameMocks";

import { createElement } from "react";
import { act, create, type ReactTestInstance } from "react-test-renderer";

import KidsParentLock from "@/components/kids/KidsParentLock";
import { kidsGames } from "@/data/kidsGames";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useGameStore } from "@/store/useGameStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { KIDS_ANIMALS, KIDS_SIMON_PADS } from "@/utils/kidsGames";
import {
  type Harness,
  labelOf,
  mountGame,
  must,
  repeat,
} from "./helpers/gameHarness";
import { solveSlidingPuzzle } from "./helpers/gameSolvers";

type Node = ReactTestInstance;

const AGAIN = "kidsAgain";
const HOME = "kidsHome";
const CARD_HIDDEN = /^kidsA11yCard/;
const ANIMALS = new Set<string>(KIDS_ANIMALS);
const PADS = new Set<string>(KIDS_SIMON_PADS);
const SLOT = /^kids-slot-(\d+)-(\d+)$/;
const ITEM_LANE = /^kids-item-lane-(\d+)$/;
const RULES_OR_COUNTDOWN = /Rules|gameCountdown|GO/;
const SCORE_UI = /gameBest|gameLast|gameStreak|\d{2,}/;

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
  useGameStore.setState({ progress: {} });
  useAchievementStore.setState({ newUnlockedIds: [], unlockedIds: [] });
  useSettingsStore.setState({ kidsMode: true });
});

afterEach(() => {
  useSettingsStore.setState({ kidsMode: false });
  jest.useRealTimers();
});

const celebrating = (h: Harness) => h.has(AGAIN) && h.has(HOME);

/** Game controls on screen (Simon's pads are disabled while it shows). */
const controls = (h: Harness) =>
  h.r.root.findAll((n: Node) => typeof n.props.onPress === "function").length;

/** Runs `body` until the celebration shows (or `times` runs out). */
const untilCelebration = (h: Harness, times: number, body: () => unknown) =>
  repeat(times, () => (celebrating(h) ? false : body()));

/** Remembers revealed faces and flips known pairs. */
async function playMemory(h: Harness) {
  const known = new Map<number, string>();
  const cards = () => h.findAll((l) => CARD_HIDDEN.test(l) || ANIMALS.has(l));
  const flip = (i: number) => {
    h.pressNode(cards()[i]);
    const card = cards()[i];
    if (card && ANIMALS.has(labelOf(card))) {
      known.set(i, labelOf(card));
    }
  };
  await untilCelebration(h, 40, async () => {
    const hidden = cards()
      .map((c, i) => (CARD_HIDDEN.test(labelOf(c)) ? i : -1))
      .filter((i) => i >= 0);
    const partnerOf = (a: number) =>
      hidden.find(
        (b) => b !== a && known.has(b) && known.get(b) === known.get(a)
      );
    const first =
      hidden.find((a) => known.has(a) && partnerOf(a) !== undefined) ??
      hidden.find((i) => !known.has(i)) ??
      hidden[0];
    if (first === undefined) {
      return;
    }
    flip(first);
    const second =
      partnerOf(first) ?? hidden.find((i) => i !== first && !known.has(i));
    if (second !== undefined) {
      flip(second);
    }
    await h.advance(1400);
  });
}

/** Taps a wrong picture once (gentle, nothing lost), then the odd one. */
async function playOddOneOut(h: Harness) {
  let triedWrong = false;
  await untilCelebration(h, 30, async () => {
    const tiles = h.candidates();
    const labels = tiles.map(labelOf);
    const oddIndex = labels.findIndex(
      (l) => labels.filter((x) => x === l).length === 1
    );
    if (oddIndex < 0) {
      await h.advance(300);
      return;
    }
    if (!triedWrong) {
      triedWrong = true;
      h.pressNode(tiles[(oddIndex + 1) % tiles.length]);
      await h.advance(600);
      must(!celebrating(h), "a wrong tap must not end the game");
    }
    h.pressNode(h.candidates()[oddIndex]);
    await h.advance(900);
  });
}

/** Watches the slow playback, then taps it back (one deliberate mistake). */
async function playSimonSays(h: Harness) {
  /** One node per pad, in pad order (composite wrappers share props). */
  const pads = () => {
    const all = h.r.root.findAll(
      (n: Node) =>
        typeof n.props.onPress === "function" &&
        PADS.has(n.props.accessibilityLabel)
    );
    return KIDS_SIMON_PADS.map(
      (emoji) => all.find((n) => n.props.accessibilityLabel === emoji) as Node
    );
  };
  let mistakeMade = false;
  await untilCelebration(h, 12, async () => {
    const seen: number[] = [];
    let previous: number | null = null;
    // Watch until the pads become enabled.
    await repeat(200, async () => {
      const all = pads();
      if (all.length > 0 && all.every((p) => !p.props.disabled)) {
        return false;
      }
      const lit = all.findIndex((p) => p.props.accessibilityState?.selected);
      const now = lit >= 0 ? lit : null;
      if (now !== null && now !== previous) {
        seen.push(now);
      }
      previous = now;
      await h.advance(100, 100);
    });
    must(seen.length > 0, "simon played a sequence");
    if (!mistakeMade && seen.length >= 1) {
      mistakeMade = true;
      h.pressNode(pads()[(seen[0] + 1) % KIDS_SIMON_PADS.length]);
      await h.advance(300, 100);
      must(!celebrating(h), "a mistake must not end the game");
      return; // the same sequence replays
    }
    for (const pad of seen) {
      h.pressNode(pads()[pad]);
      // biome-ignore lint/performance/noAwaitInLoops: game time is sequential
      await h.advance(100, 100);
    }
  });
}

/** Taps the hamster whenever it is up. */
function playWhackMole(h: Harness) {
  return untilCelebration(h, 300, async () => {
    h.press("🐹");
    await h.advance(200, 100);
  });
}

/** Reads the 3×3 board from the slots and solves it. */
async function playSlidingPuzzle(h: Harness) {
  const slots = () => {
    const out = new Map<number, { node: Node | null; value: number }>();
    for (const n of h.r.root.findAll(
      (x: Node) =>
        typeof x.props.testID === "string" && SLOT.test(x.props.testID)
    )) {
      const [, index, value] = SLOT.exec(n.props.testID) ?? [];
      const prev = out.get(Number(index));
      const pressable = typeof n.props.onPress === "function" ? n : null;
      out.set(Number(index), {
        node: prev?.node ?? pressable,
        value: Number(value),
      });
    }
    return out;
  };
  const board = Array.from({ length: 9 }, (_, i) => slots().get(i)?.value ?? 0);
  const path = must(solveSlidingPuzzle(board, 3), "3×3 puzzle path");
  for (const index of path) {
    const node = slots().get(index)?.node;
    if (node) {
      h.pressNode(node);
    }
  }
  await h.advance(300);
}

/** Moves the basket under the lowest falling present. */
function playCargoCatch(h: Harness) {
  return untilCelebration(h, 400, async () => {
    const items = h.r.root.findAll(
      (n: Node) =>
        typeof n.props.testID === "string" && ITEM_LANE.test(n.props.testID)
    );
    if (items.length > 0) {
      const lane = Number(ITEM_LANE.exec(items[0].props.testID)?.[1] ?? 0);
      h.press(`kidsA11yLane(n=${lane + 1})`);
    }
    await h.advance(200, 100);
  });
}

const DRIVERS: Record<string, (h: Harness) => Promise<unknown>> = {
  "cargo-catch": playCargoCatch,
  memory: playMemory,
  "odd-one-out": playOddOneOut,
  "simon-says": playSimonSays,
  "sliding-puzzle": playSlidingPuzzle,
  "whack-mole": playWhackMole,
};

test("every kids game has a driver", () => {
  expect(kidsGames.map((g) => g.id).sort()).toEqual(
    Object.keys(DRIVERS).sort()
  );
});

describe.each(kidsGames.map((g) => [g.id, g] as const))(
  "kids %s",
  (id, game) => {
    test("starts at once, progresses, celebrates, records nothing", async () => {
      const errors = jest.spyOn(console, "error");
      const onHome = jest.fn();
      const Component = game.loadComponent();
      const h = mountGame(() => createElement(Component, { onHome }), 3);
      try {
        h.layoutAll();
        h.snapshot();
        // No rules text, no countdown: playable controls right away.
        expect(controls(h)).toBeGreaterThan(0);
        expect(h.screen()).not.toMatch(RULES_OR_COUNTDOWN);
        await DRIVERS[id](h);
        expect(celebrating(h)).toBe(true);
        expect(h.distinctFrames()).toBeGreaterThan(1);
        // Records nothing.
        expect(h.calls).toEqual([]);
        expect(useGameStore.getState().progress).toEqual({});
        expect(useAchievementStore.getState().unlockedIds).toEqual([]);
        // No score / best / streak UI on the celebration screen.
        expect(h.screen()).not.toMatch(SCORE_UI);
        // 🏠 goes home; ▶ plays again.
        h.press(HOME);
        expect(onHome).toHaveBeenCalledTimes(1);
        h.press(AGAIN);
        await h.advance(500);
        expect(celebrating(h)).toBe(false);
        expect(controls(h)).toBeGreaterThan(0);
        expect(errors).not.toHaveBeenCalled();
      } finally {
        h.unmount();
        errors.mockRestore();
      }
    }, 30_000);
  }
);

describe("parent lock", () => {
  function mountLock() {
    const onUnlock = jest.fn();
    let r: ReturnType<typeof create> | undefined;
    act(() => {
      r = create(createElement(KidsParentLock, { onUnlock }));
    });
    const renderer = r as ReturnType<typeof create>;
    const button = () =>
      renderer.root.find(
        (n: Node) =>
          n.props.testID === "kids-parent-lock" &&
          typeof n.props.onPressIn === "function"
      );
    return { button, onUnlock, renderer };
  }

  test("releasing before 3 s cancels; a full 3 s hold unlocks once", () => {
    const { button, onUnlock, renderer } = mountLock();
    expect(button().props.accessibilityLabel).toBe("kidsLockLabel");
    expect(button().props.accessibilityHint).toBe("kidsLockHint");
    act(() => button().props.onPressIn());
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    act(() => button().props.onPressOut());
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onUnlock).not.toHaveBeenCalled();

    act(() => button().props.onPressIn());
    act(() => {
      jest.advanceTimersByTime(3100);
    });
    expect(onUnlock).toHaveBeenCalledTimes(1);
    act(() => button().props.onPressOut());
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onUnlock).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });
});

describe("kids home", () => {
  test("shows one big labelled tile per kids game and the parent lock", () => {
    const KidsHome = require("@/app/kids/index").default;
    let r: ReturnType<typeof create> | undefined;
    act(() => {
      r = create(createElement(KidsHome));
    });
    const renderer = r as ReturnType<typeof create>;
    const tiles = renderer.root.findAll(
      (n: Node) =>
        typeof n.props.onPress === "function" &&
        kidsGames.some((g) => g.labelKey === n.props.accessibilityLabel)
    );
    expect(tiles).toHaveLength(kidsGames.length);
    for (const tile of tiles) {
      const style = Object.assign(
        {},
        ...[tile.props.style({ pressed: false })].flat()
      );
      expect(style.width).toBeGreaterThanOrEqual(64);
      expect(style.height).toBeGreaterThanOrEqual(64);
    }
    expect(
      renderer.root.findAll((n: Node) => n.props.testID === "kids-parent-lock")
        .length
    ).toBeGreaterThan(0);
    act(() => renderer.unmount());
  });
});
