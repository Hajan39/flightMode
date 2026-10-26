type AnalyticsModule = typeof import("@/utils/analytics");

/** In-memory AsyncStorage stand-in shared across "app runs". */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    removeItem: (key: string) => {
      data.delete(key);
      return Promise.resolve();
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

/** Fresh module per test (= per app run): queue / sink / flags are module state. */
function loadAnalytics(
  storage: ReturnType<typeof memoryStorage> = memoryStorage()
): AnalyticsModule {
  let mod: AnalyticsModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/utils/analytics") as AnalyticsModule;
  });
  if (!mod) {
    throw new Error("analytics module failed to load");
  }
  mod.setAnalyticsQueueStorage(storage);
  return mod;
}

/** [name, properties] of every sink call (timestamp checked separately). */
function eventsOf(sink: jest.Mock) {
  return sink.mock.calls.map((c) => [c[0], c[1]]);
}

afterEach(() => {
  jest.useRealTimers();
});

describe("analytics queue", () => {
  test("events before the sink is ready are buffered and flushed in order", () => {
    const a = loadAnalytics();
    a.captureAnalyticsEvent("app_open");
    a.captureAnalyticsEvent("game_start", { game_id: "memory" });
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(eventsOf(sink)).toEqual([
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
    expect(sink).toHaveBeenCalledWith(
      "relax_start",
      { minutes: 5 },
      expect.any(Date)
    );
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
    expect(eventsOf(sink)).toEqual([
      ["game_finish", { is_new_best: false, score: 0, tag: "" }],
    ]);
  });

  test("at the cap the OLDEST held events are dropped", () => {
    const a = loadAnalytics();
    const total = a.MAX_PENDING_EVENTS + 50;
    for (let i = 0; i < total; i += 1) {
      a.captureAnalyticsEvent("game_finish", { score: i });
    }
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink).toHaveBeenCalledTimes(a.MAX_PENDING_EVENTS);
    expect(sink.mock.calls[0][1]).toEqual({ score: 50 });
    expect(sink.mock.calls.at(-1)?.[1]).toEqual({ score: total - 1 });
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
    expect(eventsOf(next)).toEqual([["profile_open", undefined]]);
  });
});

describe("analytics capture time", () => {
  test("held events keep their capture timestamp through hold → send", () => {
    jest.useFakeTimers();
    const a = loadAnalytics();
    const capturedAt = Date.UTC(2026, 9, 26, 8, 0);
    jest.setSystemTime(capturedAt);
    a.setAnalyticsSink(null);
    a.captureAnalyticsEvent("game_start", { game_id: "memory" });
    jest.setSystemTime(capturedAt + 3 * 60 * 60 * 1000); // landed, Wi-Fi
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink).toHaveBeenCalledTimes(1);
    expect((sink.mock.calls[0][2] as Date).getTime()).toBe(capturedAt);
  });

  test("timestamps survive a restart via the durable queue", async () => {
    jest.useFakeTimers();
    const storage = memoryStorage();
    const first = loadAnalytics(storage);
    await first.restoreAnalyticsQueue();
    const capturedAt = Date.UTC(2026, 9, 26, 9, 30);
    jest.setSystemTime(capturedAt);
    first.captureAnalyticsEvent("relax_start", { minutes: 5 });
    await first.flushAnalyticsQueueWrites();

    jest.setSystemTime(capturedAt + 60 * 60 * 1000);
    const second = loadAnalytics(storage);
    const sink = jest.fn();
    second.setAnalyticsSink(sink);
    await second.restoreAnalyticsQueue();
    expect(eventsOf(sink)).toEqual([["relax_start", { minutes: 5 }]]);
    expect((sink.mock.calls[0][2] as Date).getTime()).toBe(capturedAt);
  });
});

describe("durable hold queue", () => {
  test("held events survive an app kill and merge older-first", async () => {
    const storage = memoryStorage();
    const run1 = loadAnalytics(storage);
    await run1.restoreAnalyticsQueue();
    run1.setAnalyticsSink(null);
    run1.captureAnalyticsEvent("game_start", { n: 1 });
    run1.captureAnalyticsEvent("game_finish", { n: 2 });
    await run1.flushAnalyticsQueueWrites();
    expect(storage.data.has(run1.ANALYTICS_QUEUE_KEY)).toBe(true);

    // Restart: an event captured before the stored queue was read.
    const run2 = loadAnalytics(storage);
    run2.captureAnalyticsEvent("app_open", { n: 3 });
    await run2.restoreAnalyticsQueue();
    const sink = jest.fn();
    run2.setAnalyticsSink(sink);
    expect(eventsOf(sink)).toEqual([
      ["game_start", { n: 1 }],
      ["game_finish", { n: 2 }],
      ["app_open", { n: 3 }],
    ]);
    await run2.flushAnalyticsQueueWrites();
    // Handed to PostHog: the durable copy is gone.
    expect(storage.data.has(run2.ANALYTICS_QUEUE_KEY)).toBe(false);
  });

  test("nothing is written before the stored queue was read (no overwrite)", async () => {
    const storage = memoryStorage();
    const run1 = loadAnalytics(storage);
    await run1.restoreAnalyticsQueue();
    run1.captureAnalyticsEvent("game_start");
    await run1.flushAnalyticsQueueWrites();
    const stored = storage.data.get(run1.ANALYTICS_QUEUE_KEY);

    const run2 = loadAnalytics(storage);
    run2.captureAnalyticsEvent("app_open");
    await run2.flushAnalyticsQueueWrites();
    expect(storage.data.get(run2.ANALYTICS_QUEUE_KEY)).toBe(stored);
  });

  test("the durable queue is capped, dropping the oldest", async () => {
    const storage = memoryStorage();
    const run1 = loadAnalytics(storage);
    await run1.restoreAnalyticsQueue();
    const total = run1.MAX_PENDING_EVENTS + 10;
    for (let i = 0; i < total; i += 1) {
      run1.captureAnalyticsEvent("game_finish", { score: i });
    }
    await run1.flushAnalyticsQueueWrites();
    const stored = JSON.parse(
      storage.data.get(run1.ANALYTICS_QUEUE_KEY) ?? "[]"
    ) as Array<{ properties: { score: number } }>;
    expect(stored).toHaveLength(run1.MAX_PENDING_EVENTS);
    expect(stored[0].properties.score).toBe(10);
    expect(stored.at(-1)?.properties.score).toBe(total - 1);
  });

  test("disabling clears the durable queue too", async () => {
    const storage = memoryStorage();
    const run1 = loadAnalytics(storage);
    await run1.restoreAnalyticsQueue();
    run1.captureAnalyticsEvent("game_start");
    await run1.flushAnalyticsQueueWrites();
    expect(storage.data.has(run1.ANALYTICS_QUEUE_KEY)).toBe(true);

    const run2 = loadAnalytics(storage);
    run2.disableAnalytics();
    await run2.restoreAnalyticsQueue();
    await run2.flushAnalyticsQueueWrites();
    await Promise.resolve();
    expect(storage.data.has(run2.ANALYTICS_QUEUE_KEY)).toBe(false);
    const sink = jest.fn();
    run2.setAnalyticsSink(sink);
    expect(sink).not.toHaveBeenCalled();
  });

  test("corrupt stored queue is ignored", async () => {
    const storage = memoryStorage();
    const a = loadAnalytics(storage);
    storage.data.set(a.ANALYTICS_QUEUE_KEY, "{not json");
    await a.restoreAnalyticsQueue();
    const sink = jest.fn();
    a.setAnalyticsSink(sink);
    expect(sink).not.toHaveBeenCalled();
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

  test("unknown (null) reachability on connected Wi-Fi may send", () => {
    const a = loadAnalytics();
    const wifi = { isConnected: true, isInternetReachable: null, type: "WIFI" };
    expect(a.analyticsNetworkAllowsUpload(wifi, "wifi_only")).toBe(true);
    expect(a.analyticsNetworkAllowsUpload(wifi, "wifi_and_mobile")).toBe(true);
    expect(a.analyticsNetworkAllowsUpload(wifi, "off")).toBe(false);
    expect(
      a.getAnalyticsUploadMode({
        enabled: true,
        hydrated: true,
        networkAllowsUpload: a.analyticsNetworkAllowsUpload(wifi, "wifi_only"),
      })
    ).toBe("send");
  });

  test("network rules: explicit unreachable, not connected, cellular on wifi_only", () => {
    const a = loadAnalytics();
    expect(
      a.analyticsNetworkAllowsUpload(
        { isConnected: true, isInternetReachable: false, type: "WIFI" },
        "wifi_and_mobile"
      )
    ).toBe(false);
    expect(
      a.analyticsNetworkAllowsUpload(
        { isConnected: null, isInternetReachable: null, type: "WIFI" },
        "wifi_and_mobile"
      )
    ).toBe(false);
    expect(
      a.analyticsNetworkAllowsUpload(
        { isConnected: true, isInternetReachable: null, type: "CELLULAR" },
        "wifi_only"
      )
    ).toBe(false);
    expect(
      a.analyticsNetworkAllowsUpload(
        { isConnected: true, isInternetReachable: null, type: "CELLULAR" },
        "wifi_and_mobile"
      )
    ).toBe(true);
    expect(
      a.analyticsNetworkAllowsUpload(
        { isConnected: true, isInternetReachable: true, type: "NONE" },
        "wifi_and_mobile"
      )
    ).toBe(false);
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
    for (const s of [
      "destination",
      "destinations",
      "direct",
      "home",
      "landed",
      "preflight",
      "tools",
    ]) {
      expect(a.normalizeRouteSource(s)).toBe(s);
    }
    expect(a.normalizeRouteSource(undefined)).toBe("direct");
    expect(a.normalizeRouteSource("")).toBe("direct");
    expect(a.normalizeRouteSource("https://evil.example/?u=me")).toBe("other");
    expect(a.normalizeRouteSource(["home", "x"])).toBe("other");
    expect(a.normalizeRouteSource("HOME")).toBe("other");
  });
});
