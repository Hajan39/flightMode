/**
 * useHaptic must hand out one referentially stable object: effects that list
 * `haptic` (GameResult / MatchResult buzz, GameCountdown, game intervals)
 * used to re-run on every render because the functions were recreated.
 */
import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useHaptic } from "@/hooks/useHaptic";

test("useHaptic returns the same object and functions on every render", () => {
  const seen: ReturnType<typeof useHaptic>[] = [];
  const Probe = ({ n }: { n: number }) => {
    seen.push(useHaptic());
    return createElement("Text", null, n);
  };
  let r: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    r = TestRenderer.create(createElement(Probe, { n: 1 }));
  });
  act(() => r?.update(createElement(Probe, { n: 2 })));
  act(() => r?.update(createElement(Probe, { n: 3 })));
  expect(seen.length).toBeGreaterThanOrEqual(3);
  for (const h of seen) {
    expect(h).toBe(seen[0]);
    expect(h.tap).toBe(seen[0].tap);
  }
  expect(Object.keys(seen[0]).sort()).toEqual([
    "error",
    "heavy",
    "success",
    "tap",
  ]);
  // Safe to call off-device (no-op on the test platform).
  expect(() => seen[0].tap()).not.toThrow();
});
