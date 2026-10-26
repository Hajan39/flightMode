/**
 * Regression render tests for timer bugs in multiplayer / reflex games:
 *  - `useEffect(() => clearTimers, [clearTimers])` with a non-memoised
 *    function ran the cleanup after every render and killed pending timers;
 *  - split-duel timeouts read stale round state from their closure;
 *  - runway-landing re-scored a round when LAND was tapped during feedback.
 * Heavy UI dependencies are mocked; game logic + timers run for real.
 */
import { createElement, type ReactNode } from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

const mockCaptured: {
  countdownComplete?: () => void;
  handoffReady?: () => void;
  handoffVisible?: boolean;
  onStart?: (players: unknown[]) => void;
  panes: Record<number, any>;
} = { panes: {} };

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const RN = jest.requireActual("react-native");
  const wrap = (C: any) => (props: any) =>
    React.createElement(C, { ...props, entering: undefined });
  const Animated = { Text: wrap(RN.Text), View: wrap(RN.View) };
  const anim = { duration: () => anim };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    FadeIn: anim,
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => React.useRef({ value: v }).current,
    withSequence: (...a: unknown[]) => a.at(-1),
    withTiming: (v: unknown) => v,
    ZoomIn: anim,
  };
});
jest.mock("@/components/multiplayer", () => ({
  MatchResult: () => null,
  PassDeviceOverlay: (p: any) => {
    mockCaptured.handoffReady = p.onReady;
    mockCaptured.handoffVisible = p.visible;
    return null;
  },
  PlayerScoreStrip: () => null,
  PlayerSetup: (p: any) => {
    mockCaptured.onStart = p.onStart;
    return null;
  },
  TurnBanner: () => null,
}));
jest.mock("@/games/split-duel/DuelPane", () => ({
  __esModule: true,
  default: (p: any) => {
    mockCaptured.panes[p.player.index] = p;
    return null;
  },
}));
jest.mock("@/components/GameCountdown", () => ({
  __esModule: true,
  default: (p: { onComplete: () => void }) => {
    mockCaptured.countdownComplete = p.onComplete;
    return null;
  },
}));
jest.mock("@/components/GameControls", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/GamePauseOverlay", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/GameResult", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/A11yOverlayScope", () => ({
  A11yOverlayContent: ({ children }: { children: ReactNode }) => children,
  A11yOverlayScope: ({ children }: { children: ReactNode }) => children,
}));
jest.mock("@/components/Themed", () => {
  const RN = jest.requireActual("react-native");
  return { Text: RN.Text, View: RN.View };
});
jest.mock("@/components/useColorScheme", () => ({
  useColorScheme: () => "light",
}));
jest.mock("@/hooks/useAutoPause", () => ({ useAutoPause: () => undefined }));
jest.mock("@/hooks/useHaptic", () => {
  const haptic = {
    error: jest.fn(),
    heavy: jest.fn(),
    success: jest.fn(),
    tap: jest.fn(),
  };
  return { useHaptic: () => haptic };
});
jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k, tn: (k: string) => k }),
}));
const mockRecordMatch = jest.fn((..._args: unknown[]) => ({}));
jest.mock("@/utils/multiplayerScoring", () => ({
  ...jest.requireActual("@/utils/multiplayerScoring"),
  recordMatch: (...a: unknown[]) => mockRecordMatch(...a),
}));
let mockChallenges: unknown[] = [];
jest.mock("@/games/split-duel/logic", () => ({
  ...jest.requireActual("@/games/split-duel/logic"),
  pickChallenges: () => mockChallenges,
}));

import DuelDiceGame from "@/games/duel-dice";
import DuelEmojiFindGame from "@/games/duel-emoji-find";
import RunwayLandingGame from "@/games/runway-landing";
import SplitDuelGame from "@/games/split-duel";
import { useGameStore } from "@/store/useGameStore";

const PLAYERS = [
  { color: "#f00", index: 0, isHost: true, name: "A" },
  { color: "#00f", index: 1, isHost: false, name: "B" },
];

const textOf = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());

beforeEach(() => {
  jest.useFakeTimers();
  mockCaptured.panes = {};
  mockRecordMatch.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const mount = (component: () => ReactNode) => {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(createElement(component));
  });
  return r as ReactTestRenderer;
};

test("duel-dice: a roll settles and passes the turn (timers survive re-renders)", () => {
  const r = mount(DuelDiceGame);
  act(() => mockCaptured.onStart?.(PLAYERS));
  const rollBtn = () =>
    r.root.find(
      (n) => n.props.accessibilityLabel === "diceTapToRoll" && n.props.onPress
    );
  act(() => rollBtn().props.onPress());
  expect(textOf(r)).toContain("A…");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  expect(textOf(r)).not.toContain("A…");
  expect(textOf(r)).toContain("B — diceTapToRoll");
  act(() => r.unmount());
  expect(jest.getTimerCount()).toBe(0);
});

test("duel-emoji-find: the turn timer runs out and hands off to the next player", () => {
  const r = mount(DuelEmojiFindGame);
  act(() => mockCaptured.onStart?.(PLAYERS));
  act(() => mockCaptured.handoffReady?.());
  act(() => mockCaptured.countdownComplete?.());
  expect(mockCaptured.handoffVisible).toBe(false);
  // Advance in 1 s steps so React re-renders between ticks (one big act()
  // would batch every tick into a single render and hide the bug).
  for (let s = 0; s < 31; s += 1) {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  }
  expect(mockCaptured.handoffVisible).toBe(true);
  act(() => r.unmount());
});

describe("split-duel", () => {
  const odd = { grid: new Array(9).fill("x"), kind: "odd", oddIndex: 4 };
  const green = { delayMs: 1000, kind: "green" };
  const math = { answer: 2, kind: "math", options: [2, 3], prompt: "1+1" };

  test("round 1 goes live with the first challenge (no stale empty list)", () => {
    mockChallenges = [green, odd, math, odd, math];
    const r = mount(SplitDuelGame);
    act(() => mockCaptured.onStart?.(PLAYERS));
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(mockCaptured.panes[0].status).toBe("live");
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(mockCaptured.panes[0].greenOn).toBe(true);
    act(() => r.unmount());
  });

  test("a timeout tie keeps earlier wins and moves on to the next round", () => {
    mockChallenges = [odd, green, math, odd, math];
    const r = mount(SplitDuelGame);
    act(() => mockCaptured.onStart?.(PLAYERS));
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    act(() => mockCaptured.panes[0].onTap(4)); // seat 0 wins round 1
    expect(mockCaptured.panes[0].wins).toBe(1);
    act(() => {
      jest.advanceTimersByTime(1600 + 2600);
    });
    expect(mockCaptured.panes[0].challenge.kind).toBe("green");
    // Nobody taps: green turns on after 1 s, the round times out 8 s later.
    act(() => {
      jest.advanceTimersByTime(9100);
    });
    expect(mockCaptured.panes[0].status).toBe("tie");
    expect(mockCaptured.panes[0].wins).toBe(1);
    expect(mockCaptured.panes[1].wins).toBe(0);
    act(() => {
      jest.advanceTimersByTime(1600 + 2600);
    });
    expect(mockCaptured.panes[0].challenge.kind).toBe("math");
    act(() => r.unmount());
    expect(jest.getTimerCount()).toBe(0);
  });
});

test("runway-landing: LAND during the feedback window does not re-score the round", () => {
  const updateProgress = jest.spyOn(useGameStore.getState(), "updateProgress");
  const r = mount(RunwayLandingGame);
  const land = () =>
    r.root.find(
      (n) => n.props.accessibilityLabel === "rlLand" && n.props.onPress
    );
  const scoreAfterFirst = () => {
    act(() => land().props.onPress());
    return textOf(r);
  };
  const first = scoreAfterFirst();
  expect(land().props.disabled).toBe(true);
  // Spam LAND while feedback shows: nothing changes.
  for (let i = 0; i < 5; i += 1) {
    act(() => land().props.onPress());
  }
  expect(textOf(r)).toBe(first);
  expect(textOf(r)).toContain('"1/');
  act(() => {
    jest.advanceTimersByTime(850);
  });
  expect(textOf(r)).toContain('"2/');
  expect(land().props.disabled).toBe(false);
  expect(updateProgress).not.toHaveBeenCalled();
  act(() => r.unmount());
  updateProgress.mockRestore();
});
