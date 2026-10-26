/**
 * The sync bootstraps must wait for their store AND settings to hydrate, and
 * image sync must re-download a cached entry whose file is gone.
 */
const mockFiles = new Map<string, string>();
let mockReleaseRead: () => void = () => undefined;
let mockReadGate: Promise<void> = Promise.resolve();
const mockDownload = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: (uri: string) => {
    mockFiles.delete(uri);
    return Promise.resolve();
  },
  documentDirectory: "file:///new-container/docs/",
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri) }),
  moveAsync: ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from) ?? "");
    mockFiles.delete(from);
    return Promise.resolve();
  },
  readAsStringAsync: async (uri: string) => {
    await mockReadGate;
    return mockFiles.get(uri);
  },
  writeAsStringAsync: (uri: string, value: string) => {
    mockFiles.set(uri, value);
    return Promise.resolve();
  },
}));
jest.mock("@/utils/analytics", () => ({ captureAnalyticsEvent: jest.fn() }));
jest.mock("@/utils/imageSync", () => ({
  downloadImage: (url: string) => mockDownload(url),
  isAllowedImageUrl: (url: unknown) =>
    typeof url === "string" && url.startsWith("https://"),
}));

import type TestRendererType from "react-test-renderer";

/** react + renderer, re-required after every `jest.resetModules()` (one React instance). */
let rt: {
  act: typeof import("react-test-renderer").act;
  create: typeof TestRendererType.create;
  createElement: typeof import("react").createElement;
};

const CONTENT_FILE = "file:///new-container/docs/persist_content_sync.json";
const IMAGE_URL = "https://img.example/a.png";

function asyncStorage() {
  const mod = require("@react-native-async-storage/async-storage");
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

const flush = async () => {
  await rt.act(async () => {
    for (let i = 0; i < 30; i += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: draining the microtask queue on purpose
      await Promise.resolve();
    }
  });
};

let fetchMock: jest.Mock;
let renderer: TestRendererType.ReactTestRenderer | null = null;

beforeAll(() => {
  // React 19 act() environment flag for react-test-renderer.
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  jest.resetModules();
  rt = {
    act: require("react-test-renderer").act,
    create: require("react-test-renderer").create,
    createElement: require("react").createElement,
  };
  mockFiles.clear();
  mockDownload.mockReset();
  await asyncStorage().clear();
  await asyncStorage().setItem(
    "settings",
    JSON.stringify({
      state: { syncNetworkPolicy: "wifi_and_mobile" },
      version: 0,
    })
  );
  mockReadGate = new Promise((r) => {
    mockReleaseRead = r;
  });
  fetchMock = jest.fn(() => new Promise(() => undefined));
  Object.defineProperty(global, "fetch", {
    configurable: true,
    value: fetchMock,
    writable: true,
  });
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  if (renderer) {
    const r = renderer;
    await rt.act(() => {
      r.unmount();
    });
    renderer = null;
  }
  jest.restoreAllMocks();
});

function online() {
  require("@/store/useNetworkStore").useNetworkStore.setState({
    isInternetReachable: true,
    type: "WIFI",
  });
}

async function mount(path: string) {
  const Component = require(path).default;
  await rt.act(() => {
    renderer = rt.create(rt.createElement(Component));
  });
}

describe("ContentSyncBootstrap", () => {
  test("does not sync until the feed file loaded, then honours its cooldown", async () => {
    mockFiles.set(
      CONTENT_FILE,
      JSON.stringify({
        state: { etag: '"e"', items: [], lastSyncAt: Date.now(), version: "v" },
        version: 0,
      })
    );
    online();
    await mount("@/components/ContentSyncBootstrap");
    await flush();
    const { useContentStore } = require("@/store/useContentStore");
    expect(useContentStore.persist.hasHydrated()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    mockReleaseRead();
    await flush();
    expect(useContentStore.persist.hasHydrated()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // fresh lastSyncAt → cooldown
    expect(useContentStore.getState().status).toBe("skipped");
  });

  test("syncs once hydrated when the cooldown has passed", async () => {
    mockFiles.set(
      CONTENT_FILE,
      JSON.stringify({
        state: { etag: '"e"', items: [], lastSyncAt: 1, version: "v" },
        version: 0,
      })
    );
    online();
    await mount("@/components/ContentSyncBootstrap");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    mockReleaseRead();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("RatesSyncBootstrap", () => {
  test("waits for the rates store and honours the 12 h cooldown", async () => {
    await asyncStorage().setItem(
      "exchange_rates",
      JSON.stringify({
        state: { lastSyncAt: Date.now(), rates: { EUR: 0.9 }, ratesAsOf: "x" },
        version: 0,
      })
    );
    online();
    await mount("@/components/RatesSyncBootstrap");
    await flush();
    const { useRatesStore } = require("@/store/useRatesStore");
    expect(useRatesStore.persist.hasHydrated()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useRatesStore.getState().rates).toEqual({ EUR: 0.9 });
  });
});

describe("ImageSyncBootstrap", () => {
  function withArticle() {
    require("@/store/useContentStore").useContentStore.setState({
      items: [
        {
          body: { en: "b" },
          category: { en: "c" },
          id: "img-article",
          image: IMAGE_URL,
          readTime: 1,
          title: { en: "t" },
        },
      ],
    });
  }

  test("re-downloads a cached image whose file no longer exists", async () => {
    await asyncStorage().setItem(
      "image_cache",
      JSON.stringify({
        // v0: absolute URI from the old iOS container.
        state: {
          cache: { [IMAGE_URL]: "file:///old/docs/article_images/a1.png" },
        },
        version: 0,
      })
    );
    mockReleaseRead();
    mockDownload.mockResolvedValue(
      "file:///new-container/docs/article_images/a1.png"
    );
    online();
    withArticle();
    await mount("@/components/ImageSyncBootstrap");
    await flush();
    expect(mockDownload).toHaveBeenCalledWith(IMAGE_URL);
    const { useImageCacheStore } = require("@/store/useImageCacheStore");
    expect(useImageCacheStore.getState().cache[IMAGE_URL]).toBe("a1.png");
  });

  test("keeps a cached image whose file exists (resolved in the new container)", async () => {
    await asyncStorage().setItem(
      "image_cache",
      JSON.stringify({
        state: {
          cache: { [IMAGE_URL]: "file:///old/docs/article_images/a1.png" },
        },
        version: 0,
      })
    );
    mockFiles.set("file:///new-container/docs/article_images/a1.png", "png");
    mockReleaseRead();
    online();
    withArticle();
    await mount("@/components/ImageSyncBootstrap");
    await flush();
    expect(mockDownload).not.toHaveBeenCalledWith(IMAGE_URL);
    const { useImageCacheStore } = require("@/store/useImageCacheStore");
    expect(useImageCacheStore.getState().cache[IMAGE_URL]).toBe("a1.png");
  });
});
