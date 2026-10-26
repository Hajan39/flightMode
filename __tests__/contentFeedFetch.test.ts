import {
  CONTENT_FEED_BODY_TIMEOUT_MS,
  CONTENT_FEED_HEADER_TIMEOUT_MS,
  CONTENT_FEED_TIMEOUT_MS,
  fetchContentFeed,
  fetchSyncedContent,
  isAcceptableFeedContentType,
} from "@/utils/contentSync";

/** Response with real per-name headers and a body that resolves after `bodyMs`. */
function feedResponse(
  status: number,
  headers: Record<string, string>,
  body?: unknown,
  bodyMs = 0
) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  const json = jest.fn(
    () =>
      new Promise((resolve) => {
        if (bodyMs > 0) {
          setTimeout(() => resolve(body), bodyMs);
        } else {
          resolve(body);
        }
      })
  );
  return {
    json,
    response: {
      headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
      json,
      ok: status >= 200 && status < 300,
      status,
    } as unknown as Response,
  };
}

function response(body: unknown, contentType: string | null, status = 200) {
  return {
    headers: { get: () => contentType },
    json: () =>
      typeof body === "string"
        ? Promise.reject(new SyntaxError("Unexpected token <"))
        : Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe("content feed fetch", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("a fetch that never resolves times out instead of hanging", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    const neverFetch = jest.fn((_url: unknown, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }) as unknown as typeof fetch;

    const pending = fetchSyncedContent(null, neverFetch);
    const assertion = expect(pending).rejects.toThrow("timed out");
    jest.advanceTimersByTime(CONTENT_FEED_TIMEOUT_MS);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  test("captive-portal HTML is rejected before parsing", async () => {
    const html = jest.fn(async () =>
      response("<html>login</html>", "text/html; charset=utf-8")
    ) as unknown as typeof fetch;
    await expect(fetchSyncedContent(null, html)).rejects.toThrow("not JSON");
  });

  test("an unparsable body is reported as not JSON", async () => {
    const broken = jest.fn(async () =>
      response("garbage", "text/plain; charset=utf-8")
    ) as unknown as typeof fetch;
    await expect(fetchSyncedContent(null, broken)).rejects.toThrow("not JSON");
  });

  test("raw.githubusercontent's text/plain JSON is accepted", async () => {
    const ok = jest.fn(async () =>
      response({ items: [], version: "v2" }, "text/plain; charset=utf-8")
    ) as unknown as typeof fetch;
    await expect(fetchSyncedContent("v1", ok)).resolves.toEqual({
      items: [],
      version: "v2",
    });
  });

  test("an HTTP error status rejects with the status", async () => {
    const down = jest.fn(async () =>
      response({ items: [], version: "v2" }, "application/json", 503)
    ) as unknown as typeof fetch;
    await expect(fetchSyncedContent(null, down)).rejects.toThrow("503");
  });

  test("a finished fetch leaves no timeout timer behind", async () => {
    jest.useFakeTimers();
    const ok = jest.fn(async () =>
      response({ items: [], version: "v2" }, "application/json")
    ) as unknown as typeof fetch;
    await fetchSyncedContent("v1", ok);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("content-type allowlist", () => {
    expect(isAcceptableFeedContentType("application/json")).toBe(true);
    expect(isAcceptableFeedContentType("application/feed+json")).toBe(true);
    expect(isAcceptableFeedContentType("text/plain; charset=utf-8")).toBe(true);
    expect(isAcceptableFeedContentType(null)).toBe(true);
    expect(isAcceptableFeedContentType("text/html")).toBe(false);
    expect(isAcceptableFeedContentType("image/png")).toBe(false);
  });
});

describe("content feed conditional requests + timeouts", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("sends If-None-Match / If-Modified-Since; a 304 downloads nothing", async () => {
    const { json, response: r } = feedResponse(304, { ETag: '"abc"' });
    const fetchMock = jest.fn(async () => r);
    const outcome = await fetchContentFeed(
      "v1",
      { etag: '"abc"', lastModified: "Mon, 26 Oct 2026 08:00:00 GMT" },
      fetchMock as unknown as typeof fetch
    );
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.headers).toMatchObject({
      "If-Modified-Since": "Mon, 26 Oct 2026 08:00:00 GMT",
      "If-None-Match": '"abc"',
    });
    expect(json).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      notModified: true,
      result: null,
      validators: {
        etag: '"abc"',
        lastModified: "Mon, 26 Oct 2026 08:00:00 GMT",
      },
    });
  });

  test("no validators → no conditional headers; 200 returns the new ETag", async () => {
    const { response: r } = feedResponse(
      200,
      { "content-type": "text/plain", ETag: '"new"' },
      { items: [], version: "v2" }
    );
    const fetchMock = jest.fn(async () => r);
    const outcome = await fetchContentFeed(
      null,
      null,
      fetchMock as unknown as typeof fetch
    );
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(outcome.result).toEqual({ items: [], version: "v2" });
    expect(outcome.validators).toEqual({ etag: '"new"', lastModified: null });
  });

  test("headers that never arrive time out after the header budget", async () => {
    jest.useFakeTimers();
    const pending = fetchContentFeed(
      null,
      null,
      jest.fn(
        () => new Promise<Response>(() => undefined)
      ) as unknown as typeof fetch
    );
    const assertion = expect(pending).rejects.toThrow("timed out (headers)");
    jest.advanceTimersByTime(CONTENT_FEED_HEADER_TIMEOUT_MS);
    await assertion;
  });

  test("a slow body is allowed past the header budget, within the body budget", async () => {
    jest.useFakeTimers();
    const slowMs = CONTENT_FEED_HEADER_TIMEOUT_MS * 3;
    expect(slowMs).toBeLessThan(CONTENT_FEED_BODY_TIMEOUT_MS);
    const { response: r } = feedResponse(
      200,
      { "content-type": "application/json" },
      { items: [], version: "v9" },
      slowMs
    );
    const pending = fetchContentFeed(
      null,
      null,
      jest.fn(async () => r) as unknown as typeof fetch
    );
    await jest.advanceTimersByTimeAsync(slowMs);
    await expect(pending).resolves.toMatchObject({
      result: { items: [], version: "v9" },
    });
  });

  test("a body slower than the body budget times out", async () => {
    jest.useFakeTimers();
    const { response: r } = feedResponse(
      200,
      { "content-type": "application/json" },
      { items: [], version: "v9" },
      CONTENT_FEED_BODY_TIMEOUT_MS * 2
    );
    const pending = fetchContentFeed(
      null,
      null,
      jest.fn(async () => r) as unknown as typeof fetch
    );
    const assertion = expect(pending).rejects.toThrow("timed out (body)");
    await jest.advanceTimersByTimeAsync(CONTENT_FEED_BODY_TIMEOUT_MS);
    await assertion;
  });
});

describe("content store conditional sync", () => {
  test("a 304 keeps the cached feed and marks success", async () => {
    jest.resetModules();
    jest.doMock("@/utils/fileStorage", () => ({
      fileStorage: {
        getItem: async () => null,
        removeItem: async () => undefined,
        setItem: async () => undefined,
      },
    }));
    // Save the descriptor, not the value: reading expo's lazy `fetch` getter
    // loads a native module that warns after the suite ends.
    const realFetch = Object.getOwnPropertyDescriptor(global, "fetch");
    const { response: r } = feedResponse(304, {});
    const fetchMock = jest.fn(async () => r);
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { useContentStore } =
        require("@/store/useContentStore") as typeof import("@/store/useContentStore");
      const { useNetworkStore } =
        require("@/store/useNetworkStore") as typeof import("@/store/useNetworkStore");
      const { useSettingsStore } =
        require("@/store/useSettingsStore") as typeof import("@/store/useSettingsStore");
      /* eslint-enable @typescript-eslint/no-require-imports */
      useNetworkStore.setState({ isInternetReachable: true, type: "WIFI" });
      useSettingsStore.setState({ syncNetworkPolicy: "wifi_only" });
      const cached = [{ id: "a" }] as never;
      useContentStore.setState({
        etag: '"v1-etag"',
        items: cached,
        lastSyncAt: null,
        version: "v1",
      });

      await useContentStore.getState().syncContent();
      const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
      expect(init.headers).toMatchObject({ "If-None-Match": '"v1-etag"' });
      const state = useContentStore.getState();
      expect(state.status).toBe("success");
      expect(state.items).toBe(cached);
      expect(state.version).toBe("v1");
      expect(state.etag).toBe('"v1-etag"');
      expect(state.lastSyncAt).not.toBeNull();
    } finally {
      if (realFetch) {
        Object.defineProperty(global, "fetch", realFetch);
      }
    }
  });
});

describe("content store on a hanging feed", () => {
  test("status ends in error (not stuck syncing) after the timeout", async () => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.doMock("@/utils/fileStorage", () => ({
      fileStorage: {
        getItem: async () => null,
        removeItem: async () => undefined,
        setItem: async () => undefined,
      },
    }));
    const realFetch = global.fetch;
    global.fetch = jest.fn(
      () => new Promise<Response>(() => undefined)
    ) as unknown as typeof fetch;
    try {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { useContentStore } =
        require("@/store/useContentStore") as typeof import("@/store/useContentStore");
      const { useNetworkStore } =
        require("@/store/useNetworkStore") as typeof import("@/store/useNetworkStore");
      const { useSettingsStore } =
        require("@/store/useSettingsStore") as typeof import("@/store/useSettingsStore");
      /* eslint-enable @typescript-eslint/no-require-imports */
      useNetworkStore.setState({ isInternetReachable: true, type: "WIFI" });
      useSettingsStore.setState({ syncNetworkPolicy: "wifi_only" });

      const run = useContentStore.getState().syncContent();
      expect(useContentStore.getState().status).toBe("syncing");
      jest.advanceTimersByTime(CONTENT_FEED_TIMEOUT_MS);
      await run;
      expect(useContentStore.getState().status).toBe("error");
    } finally {
      global.fetch = realFetch;
      jest.useRealTimers();
    }
  });
});
