/**
 * Tiny driver toolkit for render smoke tests of games (see
 * `__tests__/gamesSmoke.test.ts`). Works on `react-test-renderer` trees with
 * jest fake timers: finds pressables by accessibility label / text, presses
 * them, advances time in small steps (so React re-renders between timer
 * ticks, like on a device) and records how the rendered output changes.
 */
import type { ComponentType } from "react";
import { createElement } from "react";
import TestRenderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { useGameStore } from "@/store/useGameStore";

type Node = ReactTestInstance;
export type Matcher =
  | string
  | RegExp
  | ((label: string, node: Node) => boolean);

/** Controls every game has that would abandon / restart the run. */
const NEVER_PRESS = [
  "gamePause",
  "gameResume",
  "gameRestart",
  "gameQuit",
  "mpRematch",
  "mpChangePlayers",
  "mpAddNames",
  "mpHideNames",
  "playAgain",
  "selectLevel",
];

/** Buttons that move a run forward (start, hand-off ready, next round …). */
export const FORWARD = [
  "start",
  "play",
  "gameTapToStart",
  "reactionTapToStart",
  "gameReady",
  "passPhoneReady",
];

/** Size reported to every onLayout (portrait phone game column). */
export const LAYOUT = { height: 640, width: 360 };

/** A responder / touch event at page coordinates (x, y). */
export const touchEvent = (x: number, y: number) => ({
  nativeEvent: {
    locationX: x,
    locationY: y,
    pageX: x,
    pageY: y,
    timestamp: Date.now(),
    touches: [],
  },
  persist: () => undefined,
  preventDefault: () => undefined,
  stopPropagation: () => undefined,
  touchHistory: { touchBank: [] },
});

const PRESS_EVENT = {
  nativeEvent: { locationX: 10, locationY: 10, pageX: 10, pageY: 10 },
  preventDefault: () => undefined,
  stopPropagation: () => undefined,
};

/**
 * Sequential async loop: game time must advance strictly step by step (never
 * in parallel), so this recursion stands in for `for … await`. The body
 * returns `false` to stop early.
 */
export function repeat(
  times: number,
  body: (i: number) => unknown
): Promise<void> {
  const next = async (i: number): Promise<void> => {
    if (i >= times || (await body(i)) === false) {
      return;
    }
    return next(i + 1);
  };
  return next(0);
}

/** Throws (failing the test) when a driver can't find what it needs. */
export function must<T>(value: T | null | undefined | false, what: string): T {
  if (!value) {
    throw new Error(`smoke driver: ${what}`);
  }
  return value;
}

/** Seeded PRNG (mulberry32) so every smoke run is reproducible. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function nodeText(n: Node): string {
  const out: string[] = [];
  const walk = (x: Node | string) => {
    if (typeof x === "string") {
      out.push(x);
      return;
    }
    for (const c of x.children) {
      walk(c);
    }
  };
  walk(n);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export function labelOf(n: Node): string {
  const l = n.props.accessibilityLabel;
  return typeof l === "string" && l.length > 0 ? l : nodeText(n);
}

const matches = (m: Matcher, label: string, n: Node) => {
  if (typeof m === "string") {
    return label === m;
  }
  if (m instanceof RegExp) {
    return m.test(label);
  }
  return m(label, n);
};

const canActivate = (n: Node) =>
  typeof n.props.onAccessibilityAction === "function" &&
  Array.isArray(n.props.accessibilityActions) &&
  n.props.accessibilityActions.some(
    (a: { name: string }) => a.name === "activate"
  );

/** Tappable: an onPress handler, or a screen-reader "activate" action. */
const isPressable = (n: Node) =>
  typeof n.props.onPress === "function" || canActivate(n);

const insideHiddenSubtree = (n: Node) => {
  for (let p: Node | null = n; p; p = p.parent) {
    if (p.props.importantForAccessibility === "no-hide-descendants") {
      return true;
    }
  }
  return false;
};

export interface MonkeyOptions {
  /** Labels never pressed in this game (substring or regex match). */
  avoid?: Matcher[];
  /** Labels to press whenever present (default FORWARD). */
  prefer?: Matcher[];
  /** Game time per monkey step (default 500 ms). */
  stepMs?: number;
  /** Probability to swipe (on a game gesture view) instead of pressing. */
  swipeChance?: number;
}

export interface Harness {
  /** Run raw handler calls (e.g. responder events) inside act(). */
  act: (fn: () => void) => void;
  advance: (ms: number, stepMs?: number) => Promise<void>;
  /** All updateProgress calls (recordMatch goes through it too). */
  calls: unknown[][];
  /** Interactive, visible, enabled pressables (innermost onPress owners). */
  candidates: () => Node[];
  /** Number of distinct rendered outputs seen so far. */
  distinctFrames: () => number;
  find: (m: Matcher) => Node | undefined;
  findAll: (m: Matcher) => Node[];
  gestureViews: () => Node[];
  has: (m: Matcher) => boolean;
  labels: () => string[];
  layoutAll: () => void;
  monkey: (ms: number, opts?: MonkeyOptions) => Promise<void>;
  press: (m: Matcher) => boolean;
  pressNode: (n: Node) => void;
  r: ReactTestRenderer;
  rnd: () => number;
  /** Plain text of the whole screen. */
  screen: () => string;
  snapshot: () => void;
  swipe: (
    dir: "up" | "down" | "left" | "right",
    from?: { x: number; y: number }
  ) => void;
  unmount: () => void;
}

const fingerprint = (r: ReactTestRenderer) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(r.toJSON(), (k, v) => {
    if (k.startsWith("_") || typeof v === "function") {
      return;
    }
    if (v && typeof v === "object") {
      if (seen.has(v)) {
        return;
      }
      seen.add(v);
    }
    return v;
  });
};

export function mountGame(component: ComponentType, seed = 1): Harness {
  const calls: unknown[][] = [];
  const original = useGameStore.getState().updateProgress;
  useGameStore.setState({
    updateProgress: ((...args: Parameters<typeof original>) => {
      calls.push(args);
      return original(...args);
    }) as typeof original,
  });
  const restoreStore = () =>
    useGameStore.setState({ updateProgress: original });

  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(createElement(component));
  });
  const r = renderer as ReactTestRenderer;
  const frames = new Set<string>();
  const rnd = seeded(seed);

  const snapshot = () => {
    frames.add(fingerprint(r));
  };

  // Candidate list is cached per rendered version: every act() below bumps it.
  let version = 0;
  let cached: { label: string; node: Node }[] | null = null;
  let cachedAt = -1;
  const bump = () => {
    version += 1;
  };

  const scan = () => {
    if (cached && cachedAt === version) {
      return cached;
    }
    cached = computeCandidates().map((node) => ({
      label: labelOf(node),
      node,
    }));
    cachedAt = version;
    return cached;
  };
  const candidates = () => scan().map((c) => c.node);

  const computeCandidates = () => {
    const all = r.root.findAll(isPressable);
    const owners = new Set<Node>();
    for (const n of all) {
      for (let p = n.parent; p; p = p.parent) {
        if (isPressable(p)) {
          owners.add(p);
        }
      }
    }
    const seenFns = new Set<unknown>();
    return all.filter((n) => {
      const fn = n.props.onPress ?? n.props.onAccessibilityAction;
      if (owners.has(n) || seenFns.has(fn)) {
        return false;
      }
      seenFns.add(fn);
      if (n.props.disabled === true || n.props.accessibilityState?.disabled) {
        return false;
      }
      if (insideHiddenSubtree(n)) {
        return false;
      }
      const l = labelOf(n);
      return !NEVER_PRESS.some((k) => l === k || l.endsWith(k));
    });
  };

  const findAll = (m: Matcher) =>
    scan()
      .filter((c) => matches(m, c.label, c.node))
      .map((c) => c.node);
  const find = (m: Matcher) => findAll(m)[0];

  let presses = 0;
  const pressNode = (n: Node) => {
    bump();
    act(() => {
      if (typeof n.props.onPress === "function") {
        n.props.onPress(PRESS_EVENT);
      } else {
        n.props.onAccessibilityAction({
          nativeEvent: { actionName: "activate" },
        });
      }
    });
    layoutAll();
    presses += 1;
    if (presses % 3 === 1) {
      snapshot();
    }
  };

  /** Fire every not-yet-fired onLayout once (the test renderer never lays out). */
  const laidOut = new WeakSet<Node>();
  const layoutAll = () => {
    const pending = r.root.findAll(
      (n) => typeof n.props.onLayout === "function" && !laidOut.has(n)
    );
    if (pending.length === 0) {
      return;
    }
    bump();
    act(() => {
      for (const n of pending) {
        laidOut.add(n);
        n.props.onLayout({
          nativeEvent: {
            layout: { height: LAYOUT.height, width: LAYOUT.width, x: 0, y: 0 },
          },
        });
      }
    });
  };

  /** Game-owned gesture views (Pressable's own host view also has responder props, plus onClick). */
  const gestureViews = () =>
    r.root.findAll(
      (n) =>
        typeof n.props.onResponderGrant === "function" &&
        typeof n.props.onResponderRelease === "function" &&
        typeof n.props.onClick !== "function" &&
        !insideHiddenSubtree(n)
    );

  /** Swipe on the outermost game gesture view. */
  const swipe = (
    dir: "up" | "down" | "left" | "right",
    from = { x: 150, y: 150 }
  ) => {
    const [target] = gestureViews();
    if (!target) {
      return;
    }
    const d = { down: [0, 80], left: [-80, 0], right: [80, 0], up: [0, -80] }[
      dir
    ];
    bump();
    act(() => {
      target.props.onResponderGrant(touchEvent(from.x, from.y));
      target.props.onResponderMove?.(
        touchEvent(from.x + d[0] / 2, from.y + d[1] / 2)
      );
      target.props.onResponderMove?.(touchEvent(from.x + d[0], from.y + d[1]));
      target.props.onResponderRelease(touchEvent(from.x + d[0], from.y + d[1]));
    });
    snapshot();
  };
  const canSwipe = () => gestureViews().length > 0;

  const press = (m: Matcher) => {
    const n = find(m);
    if (!n) {
      return false;
    }
    pressNode(n);
    return true;
  };

  let stepCount = 0;
  /** Advance game time in `stepMs` slices, one async act() per slice. */
  const advance = (ms: number, stepMs = 250) =>
    repeat(Math.ceil(ms / stepMs), async (i) => {
      // Async act flushes promise continuations (async game flows) too.
      bump();
      await act(async () => {
        jest.advanceTimersByTime(Math.min(stepMs, ms - i * stepMs));
        await Promise.resolve();
      });
      stepCount += 1;
      if (stepCount % 4 === 0) {
        snapshot();
      }
    });

  const monkeyStep = (opts: MonkeyOptions) => {
    layoutAll();
    if (opts.swipeChance && rnd() < opts.swipeChance && canSwipe()) {
      const dirs = ["up", "down", "left", "right"] as const;
      swipe(dirs[Math.floor(rnd() * 4)]);
      return;
    }
    const prefer = opts.prefer ?? FORWARD;
    const avoid = opts.avoid ?? [];
    const c = scan().filter(
      ({ label, node }) =>
        !avoid.some((a) =>
          typeof a === "string" ? label.includes(a) : matches(a, label, node)
        )
    );
    const preferred = c.find(({ label, node }) =>
      prefer.some((p) => matches(p, label, node))
    );
    const pick = preferred ?? c[Math.floor(rnd() * c.length)];
    if (pick) {
      pressNode(pick.node);
    }
  };

  /** Random play for `ms` of game time; stops once updateProgress was called. */
  const monkey = (ms: number, opts: MonkeyOptions = {}) => {
    const stepMs = opts.stepMs ?? 500;
    return repeat(Math.ceil(ms / stepMs), async () => {
      if (calls.length > 0) {
        return false;
      }
      monkeyStep(opts);
      await advance(stepMs, stepMs);
    });
  };

  return {
    act: (fn: () => void) => {
      bump();
      act(fn);
      snapshot();
    },
    advance,
    calls,
    candidates,
    distinctFrames: () => frames.size,
    find,
    findAll,
    gestureViews,
    has: (m) => find(m) !== undefined,
    labels: () => scan().map((c) => c.label),
    layoutAll,
    monkey,
    press,
    pressNode,
    r,
    rnd,
    screen: () => nodeText(r.root),
    snapshot,
    swipe,
    unmount: () => {
      act(() => r.unmount());
      restoreStore();
    },
  };
}
