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

describe("analytics upload gating", () => {
  test("nothing is sent before settings hydrate, even if enabled", () => {
    const a = loadAnalytics();
    expect(
      a.getAnalyticsUploadMode({
        enabled: true,
        hydrated: false,
        networkAllowsUpload: true,
      })
    ).toBe("hold");
  });

  test("opted-out users are disabled regardless of network", () => {
    const a = loadAnalytics();
    for (const networkAllowsUpload of [true, false]) {
      expect(
        a.getAnalyticsUploadMode({
          enabled: false,
          hydrated: true,
          networkAllowsUpload,
        })
      ).toBe("disabled");
    }
  });

  test("sync policy forbidding this network holds, allowing it sends", () => {
    const a = loadAnalytics();
    expect(
      a.getAnalyticsUploadMode({
        enabled: true,
        hydrated: true,
        networkAllowsUpload: false,
      })
    ).toBe("hold");
    expect(
      a.getAnalyticsUploadMode({
        enabled: true,
        hydrated: true,
        networkAllowsUpload: true,
      })
    ).toBe("send");
  });

  test("hold → disabled after hydration drops everything queued early", () => {
    const a = loadAnalytics();
    // Pre-hydration: the bridge holds (no sink) — events stay on device.
    a.setAnalyticsSink(null);
    a.captureAnalyticsEvent("app_open");
    // Hydrated settings say opted out.
    a.disableAnalytics();
    const sink = jest.fn();
    // Even a later opt-in never replays what was captured while opted out.
    a.setAnalyticsSink(sink);
    expect(sink).not.toHaveBeenCalled();
  });

  test("held events (policy forbids network) are bounded and flush once allowed", () => {
    const a = loadAnalytics();
    a.setAnalyticsSink(null);
    for (let i = 0; i < 120; i += 1) {
      a.captureAnalyticsEvent("game_finish", { score: i });
    }
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink).toHaveBeenCalledTimes(100);
  });
});

describe("flight analytics buckets", () => {
  const now = Date.UTC(2026, 0, 1, 12);
  const h = 60 * 60 * 1000;

  test("hours until departure", () => {
    const a = loadAnalytics();
    expect(a.hoursUntilDepartureBucket(now - 1, now)).toBe("past");
    expect(a.hoursUntilDepartureBucket(now, now)).toBe("<6h");
    expect(a.hoursUntilDepartureBucket(now + 5.9 * h, now)).toBe("<6h");
    expect(a.hoursUntilDepartureBucket(now + 6 * h, now)).toBe("6-24h");
    expect(a.hoursUntilDepartureBucket(now + 24 * h, now)).toBe("1-7d");
    expect(a.hoursUntilDepartureBucket(now + 7 * 24 * h - 1, now)).toBe("1-7d");
    expect(a.hoursUntilDepartureBucket(now + 7 * 24 * h, now)).toBe(">7d");
    expect(a.hoursUntilDepartureBucket(Number.NaN, now)).toBe("past");
  });

  test("flight duration", () => {
    const a = loadAnalytics();
    expect(a.flightDurationBucket(45)).toBe("<2h");
    expect(a.flightDurationBucket(119)).toBe("<2h");
    expect(a.flightDurationBucket(120)).toBe("2-5h");
    expect(a.flightDurationBucket(299)).toBe("2-5h");
    expect(a.flightDurationBucket(300)).toBe("5-9h");
    expect(a.flightDurationBucket(540)).toBe(">9h");
    expect(a.flightDurationBucket(Number.NaN)).toBe("<2h");
  });
});

describe("route source allowlist", () => {
  test("known callers pass through, missing is direct, anything else other", () => {
    const a = loadAnalytics();
    for (const s of ["home", "landed", "destinations", "destination"]) {
      expect(a.normalizeRouteSource(s)).toBe(s);
    }
    expect(a.normalizeRouteSource(undefined)).toBe("direct");
    expect(a.normalizeRouteSource("")).toBe("direct");
    expect(a.normalizeRouteSource("https://evil.example/?u=me")).toBe("other");
    expect(a.normalizeRouteSource(["home", "x"])).toBe("other");
    expect(a.normalizeRouteSource("HOME")).toBe("other");
  });
});
