type AnalyticsModule = typeof import("@/utils/analytics");

/** Fresh module per test: the queue / sink / disabled flag are module state. */
function loadAnalytics(): AnalyticsModule {
  let mod: AnalyticsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/utils/analytics") as AnalyticsModule;
  });
  if (!mod) {
    throw new Error("analytics module failed to load");
  }
  return mod;
}

describe("analytics queue", () => {
  test("events before the sink is ready are buffered and flushed in order", () => {
    const a = loadAnalytics();
    a.captureAnalyticsEvent("app_open");
    a.captureAnalyticsEvent("game_start", { game_id: "memory" });
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink.mock.calls).toEqual([
      ["app_open", undefined],
      ["game_start", { game_id: "memory" }],
    ]);
    // Flushed once: re-attaching does not replay.
    const second = jest.fn();
    a.setAnalyticsSink(second);
    expect(second).not.toHaveBeenCalled();
  });

  test("with a sink, events are delivered immediately", () => {
    const a = loadAnalytics();
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    a.captureAnalyticsEvent("relax_start", { minutes: 5 });
    expect(sink).toHaveBeenCalledWith("relax_start", { minutes: 5 });
  });

  test("null/undefined properties are stripped, falsy values kept", () => {
    const a = loadAnalytics();
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    a.captureAnalyticsEvent("game_finish", {
      is_new_best: false,
      missing: undefined,
      none: null,
      score: 0,
      tag: "",
    });
    expect(sink).toHaveBeenCalledWith("game_finish", {
      is_new_best: false,
      score: 0,
      tag: "",
    });
  });

  test("the offline buffer is capped at 100 events (oldest kept)", () => {
    const a = loadAnalytics();
    for (let i = 0; i < 150; i += 1) {
      a.captureAnalyticsEvent("game_finish", { score: i });
    }
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink).toHaveBeenCalledTimes(100);
    expect(sink.mock.calls[0][1]).toEqual({ score: 0 });
    expect(sink.mock.calls[99][1]).toEqual({ score: 99 });
  });

  test("disableAnalytics drops the queue and ignores later events", () => {
    const a = loadAnalytics();
    a.captureAnalyticsEvent("app_open");
    a.disableAnalytics();
    a.captureAnalyticsEvent("game_start");
    const sink = jest.fn();
    // Attaching a sink re-enables, but nothing from before is replayed.
    a.setAnalyticsSink(sink);
    expect(sink).not.toHaveBeenCalled();
    a.captureAnalyticsEvent("game_finish");
    expect(sink).toHaveBeenCalledTimes(1);
  });

  test("detaching the sink buffers again instead of dropping", () => {
    const a = loadAnalytics();
    const first = jest.fn();
    a.setAnalyticsSink(first);
    a.setAnalyticsSink(null);
    a.captureAnalyticsEvent("profile_open");
    expect(first).not.toHaveBeenCalled();
    const next = jest.fn();
    a.setAnalyticsSink(next);
    expect(next).toHaveBeenCalledWith("profile_open", undefined);
  });
});
