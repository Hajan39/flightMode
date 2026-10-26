/**
 * Whack-a-Mole: a pause that lands after the timer tick ended the run but
 * before React re-rendered (stale `phase === "running"` in the handler) must
 * not reopen the run — resuming used to restart the tick, which saw the
 * deadline already past and recorded the game a second time.
 */
import "./helpers/gameMocks";

import { act, type ReactTestInstance } from "react-test-renderer";

import WhackMoleGame from "@/games/whack-mole";

import { mountGame } from "./helpers/gameHarness";

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-03-10T09:00:00Z") });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const byLabel = (root: ReactTestInstance, label: string) =>
  root.findAll(
    (n) =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === "function"
  );

test("a pause in the same batch as the final tick records the run once", async () => {
  const h = mountGame(WhackMoleGame);
  try {
    expect(h.press("gameTapToStart")).toBe(true);
    // 3-2-1-GO countdown, then a few seconds of play.
    await h.advance(6000, 100);
    const [pause] = byLabel(h.r.root, "gamePause");
    expect(pause).toBeDefined();
    expect(h.calls).toHaveLength(0);

    // The deadline passes and the (stale) pause handler runs before the
    // re-render, as on a device when the tap lands right after the tick.
    act(() => {
      jest.advanceTimersByTime(30_000);
      pause.props.onPress();
    });
    expect(h.calls).toHaveLength(1);

    // Resume from the pause overlay (the header toggle only pauses).
    for (const resume of byLabel(h.r.root, "gameResume")) {
      act(() => resume.props.onPress());
    }
    await h.advance(3000, 100);
    expect(h.calls).toHaveLength(1);
  } finally {
    h.unmount();
  }
});
