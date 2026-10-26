/**
 * Regression render test: tapping Reset during word-guess's 800 ms
 * "solved" flash must not let the stale end-of-game timer flip the fresh
 * board to "over" (it used to leave a dead board that ignored typing).
 */
import { createElement } from "react";
import TestRenderer, { act, type ReactTestRenderer } from "react-test-renderer";

const mockCap: { onReset?: () => void; resultShown: boolean } = {
  resultShown: false,
};

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const RN = jest.requireActual("react-native");
  const wrap = (C: any) => (props: any) =>
    React.createElement(C, {
      ...props,
      entering: undefined,
      exiting: undefined,
      layout: undefined,
    });
  const Animated = { Text: wrap(RN.Text), View: wrap(RN.View) };
  const anim: any = new Proxy(() => anim, { get: () => () => anim });
  return new Proxy(
    {
      __esModule: true,
      default: Animated,
      ...Animated,
      useAnimatedStyle: () => ({}),
      useSharedValue: (v: unknown) => React.useRef({ value: v }).current,
      withSequence: (...a: unknown[]) => a.at(-1),
      withSpring: (v: unknown) => v,
      withTiming: (v: unknown) => v,
    },
    { get: (target: any, k) => (k in target ? target[k] : anim) }
  );
});
jest.mock("@/components/GameControls", () => ({
  __esModule: true,
  default: (p: { onReset: () => void }) => {
    mockCap.onReset = p.onReset;
    return null;
  },
}));
jest.mock("@/components/GameResult", () => ({
  __esModule: true,
  default: () => {
    mockCap.resultShown = true;
    return null;
  },
}));
jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "en", t: (k: string) => k }),
}));

import WordGuessGame from "@/games/word-guess";
import {
  getDayOfYear,
  getWordPool,
  wordGuessLanguage,
} from "@/games/word-guess/logic";

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("Reset during the solved flash leaves a playable board", () => {
  let r: ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(createElement(WordGuessGame));
  });
  const renderer = r as ReactTestRenderer;
  const press = (label: string) =>
    act(() => {
      renderer.root
        .find((n) => n.props.accessibilityLabel === label && n.props.onPress)
        .props.onPress();
    });
  press("gameTapToStart");
  const pool = getWordPool(wordGuessLanguage("en"));
  const word = pool[getDayOfYear() % pool.length].toUpperCase();
  for (const ch of word) {
    press(ch);
  }
  press("ENTER");
  act(() => {
    jest.advanceTimersByTime(300);
  });
  act(() => mockCap.onReset?.());
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  mockCap.resultShown = false;
  const before = JSON.stringify(renderer.toJSON());
  press(word[0]);
  expect(mockCap.resultShown).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).not.toBe(before);
  act(() => renderer.unmount());
  expect(jest.getTimerCount()).toBe(0);
});
