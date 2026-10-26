import {
  CONTENT_FEED_TIMEOUT_MS,
  fetchSyncedContent,
  isAcceptableFeedContentType,
} from "@/utils/contentSync";

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

  test("content-type allowlist", () => {
    expect(isAcceptableFeedContentType("application/json")).toBe(true);
    expect(isAcceptableFeedContentType("application/feed+json")).toBe(true);
    expect(isAcceptableFeedContentType("text/plain; charset=utf-8")).toBe(true);
    expect(isAcceptableFeedContentType(null)).toBe(true);
    expect(isAcceptableFeedContentType("text/html")).toBe(false);
    expect(isAcceptableFeedContentType("image/png")).toBe(false);
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
