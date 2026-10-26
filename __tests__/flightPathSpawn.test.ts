/**
 * Regression render test: flight-path planes must actually spawn.
 *
 * The telegraph interval used to fill its `toSpawn` list inside a
 * `setIncoming(prev => …)` updater and read it right after — React 19 runs
 * updaters lazily, so the list was always empty — and the game loop's
 * `setPlanes(next)` (built from a stale `planesRef`) overwrote any additive
 * spawn. Result: warnings blinked and no plane ever appeared.
 */
import { createElement, type ReactNode } from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const RN = jest.requireActual("react-native");
  const wrap = (C: any) => (props: any) =>
    React.createElement(C, { ...props, entering: undefined });
  const Animated = { Text: wrap(RN.Text), View: wrap(RN.View) };
  const anim = { delay: () => anim, duration: () => anim };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    FadeInDown: anim,
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => React.useRef({ value: v }).current,
    withSequence: (...a: unknown[]) => a.at(-1),
    withTiming: (v: unknown) => v,
  };
});
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
  useTranslation: () => ({ t: (k: string) => k }),
}));

import FlightPathGame from "@/games/flight-path";

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const countPlanes = (r: ReactTestRenderer) =>
  r.root.findAll(
    (n) => n.props.angleDeg !== undefined && n.props.trailColor !== undefined,
    { deep: false }
  ).length;

const play = (stepMs: number) => {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(createElement(FlightPathGame));
  });
  const renderer = r as ReactTestRenderer;
  const start = renderer.root.find(
    (n) => n.props.accessibilityLabel === "start" && n.props.onPress
  );
  act(() => start.props.onPress());
  let maxPlanes = 0;
  for (let ms = 0; ms < 8000; ms += stepMs) {
    act(() => {
      jest.advanceTimersByTime(stepMs);
    });
    maxPlanes = Math.max(maxPlanes, countPlanes(renderer));
  }
  act(() => renderer.unmount());
  return maxPlanes;
};

test("planes spawn when both intervals fire in one batch (like RN)", () => {
  expect(play(33)).toBeGreaterThan(0);
});

test("planes spawn when every timer gets its own render", () => {
  expect(play(1)).toBeGreaterThan(0);
});
