import { createPushGuard, PUSH_GUARD_WINDOW_MS } from "@/components/pushGuard";

describe("createPushGuard", () => {
  test("lets the first tap through and drops a quick second one", () => {
    let now = 1000;
    const allow = createPushGuard(PUSH_GUARD_WINDOW_MS, () => now);
    expect(allow()).toBe(true);
    now += 100;
    expect(allow()).toBe(false);
    now += PUSH_GUARD_WINDOW_MS;
    expect(allow()).toBe(true);
  });

  test("a rejected tap does not extend the window", () => {
    let now = 0;
    const allow = createPushGuard(600, () => now);
    expect(allow()).toBe(true);
    now = 500;
    expect(allow()).toBe(false);
    now = 600;
    expect(allow()).toBe(true);
  });
});
