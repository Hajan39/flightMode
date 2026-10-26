/**
 * Regression for the pre-hydration sync race: the content feed file (2.5 MB)
 * loads slowly; a sync started before that must neither re-download (cooldown
 * / ETag unknown) nor overwrite the cached feed on disk.
 */
const mockFiles = new Map<string, string>();
const FILE = "file:///docs/persist_content_sync.json";
let mockReleaseRead: () => void = () => undefined;
let mockReadGate: Promise<void> = Promise.resolve();

jest.mock("expo-file-system/legacy", () => ({
  deleteAsync: (uri: string) => {
    mockFiles.delete(uri);
    return Promise.resolve();
  },
  documentDirectory: "file:///docs/",
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

/** The AsyncStorage mock instance the (re-required) stores will use. */
function asyncStorage() {
  const mod = require("@react-native-async-storage/async-storage");
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

const article = {
  body: { en: "b" },
  category: { en: "c" },
  id: "x",
  readTime: 1,
  title: { en: "t" },
};

function savedFeed(lastSyncAt: number) {
  return JSON.stringify({
    state: {
      etag: '"e1"',
      items: [article],
      lastModified: null,
      lastSyncAt,
      version: "v1",
    },
    version: 0,
  });
}

const flush = async (times = 30) => {
  for (let i = 0; i < times; i += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: draining the microtask queue on purpose
    await Promise.resolve();
  }
};

interface Stores {
  useContentStore: typeof import("@/store/useContentStore").useContentStore;
  useNetworkStore: typeof import("@/store/useNetworkStore").useNetworkStore;
  useSettingsStore: typeof import("@/store/useSettingsStore").useSettingsStore;
}

async function loadStores(policy: string): Promise<Stores> {
  await asyncStorage().setItem(
    "settings",
    JSON.stringify({ state: { syncNetworkPolicy: policy }, version: 0 })
  );
  const stores: Stores = {
    useContentStore: require("@/store/useContentStore").useContentStore,
    useNetworkStore: require("@/store/useNetworkStore").useNetworkStore,
    useSettingsStore: require("@/store/useSettingsStore").useSettingsStore,
  };
  stores.useNetworkStore.setState({
    isInternetReachable: true,
    type: "WIFI",
  } as never);
  return stores;
}

let fetchMock: jest.Mock;

beforeEach(async () => {
  jest.resetModules();
  mockFiles.clear();
  await asyncStorage().clear();
  mockReadGate = new Promise((r) => {
    mockReleaseRead = r;
  });
  fetchMock = jest.fn(() => new Promise(() => undefined));
  Object.defineProperty(global, "fetch", {
    configurable: true,
    value: fetchMock,
    writable: true,
  });
});

describe("content sync vs. hydration", () => {
  test("a sync before hydration neither fetches nor touches the cached feed", async () => {
    const saved = savedFeed(Date.now());
    mockFiles.set(FILE, saved);
    const { useContentStore } = await loadStores("wifi_and_mobile");
    await flush();
    expect(useContentStore.persist.hasHydrated()).toBe(false);

    await useContentStore.getState().syncContent();
    useContentStore.setState({ status: "syncing" }); // any early set()
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockFiles.get(FILE)).toBe(saved);

    mockReleaseRead();
    await flush();
    expect(useContentStore.persist.hasHydrated()).toBe(true);
    expect(useContentStore.getState().items).toHaveLength(1);
    expect(mockFiles.get(FILE)).toBe(saved); // no needless rewrite
  });

  test("after hydration the 30-minute cooldown is honoured", async () => {
    mockFiles.set(FILE, savedFeed(Date.now() - 60_000));
    const { useContentStore } = await loadStores("wifi_and_mobile");
    mockReleaseRead();
    await flush();
    expect(useContentStore.persist.hasHydrated()).toBe(true);
    await useContentStore.getState().syncContent();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useContentStore.getState().status).toBe("skipped");
  });

  test("an expired cooldown fetches with the persisted ETag", async () => {
    mockFiles.set(FILE, savedFeed(Date.now() - 2 * 60 * 60 * 1000));
    const { useContentStore } = await loadStores("wifi_and_mobile");
    mockReleaseRead();
    await flush();
    // biome-ignore lint/complexity/noVoid: the mocked fetch never settles
    void useContentStore.getState().syncContent();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.headers).toMatchObject({ "If-None-Match": '"e1"' });
  });

  test("a persisted 'off' policy is respected even when settings load late", async () => {
    mockFiles.set(FILE, savedFeed(0));
    const storage = asyncStorage();
    await storage.setItem(
      "settings",
      JSON.stringify({ state: { syncNetworkPolicy: "off" }, version: 0 })
    );
    // Hold the settings read; everything else reads normally.
    let releaseSettings: () => void = () => undefined;
    const settingsGate = new Promise<void>((r) => {
      releaseSettings = r;
    });
    // The mock's getItem is itself a jest.fn: keep its implementation, not
    // the function (spyOn would return and re-implement that same mock).
    const getItemMock = storage.getItem as jest.Mock;
    const realGetItem = getItemMock.getMockImplementation() as (
      key: string
    ) => Promise<string | null>;
    getItemMock.mockImplementation(async (key: string) => {
      if (key === "settings") {
        await settingsGate;
      }
      return realGetItem(key);
    });
    const { useContentStore } = require("@/store/useContentStore");
    const { useSettingsStore } = require("@/store/useSettingsStore");
    require("@/store/useNetworkStore").useNetworkStore.setState({
      isInternetReachable: true,
      type: "WIFI",
    });
    mockReleaseRead();
    await flush();
    expect(useContentStore.persist.hasHydrated()).toBe(true);
    expect(useSettingsStore.persist.hasHydrated()).toBe(false);
    // Default policy (wifi_only) would allow Wi-Fi — but it is not the user's.
    await useContentStore.getState().syncContent();
    expect(fetchMock).not.toHaveBeenCalled();

    releaseSettings();
    await flush();
    expect(useSettingsStore.getState().syncNetworkPolicy).toBe("off");
    await useContentStore.getState().syncContent();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useContentStore.getState().status).toBe("skipped");
  });

  test("hydrated items are validated (invalid dropped, non-array → null)", async () => {
    mockFiles.set(
      FILE,
      JSON.stringify({
        state: { items: [article, { id: 3 }, null], version: "v1" },
        version: 0,
      })
    );
    const first = await loadStores("off");
    mockReleaseRead();
    await flush();
    expect(first.useContentStore.getState().items).toEqual([article]);

    jest.resetModules();
    mockFiles.set(
      FILE,
      JSON.stringify({ state: { items: { bad: true } }, version: 0 })
    );
    const second = await loadStores("off");
    await flush();
    expect(second.useContentStore.getState().items).toBeNull();
  });
});

describe("rates sync vs. hydration", () => {
  test("waits for hydration and then honours the 12 h cooldown", async () => {
    await asyncStorage().setItem(
      "exchange_rates",
      JSON.stringify({
        state: {
          lastSyncAt: Date.now() - 60_000,
          rates: { EUR: 0.9 },
          ratesAsOf: "2026-10-26",
        },
        version: 0,
      })
    );
    await loadStores("wifi_and_mobile");
    const { useRatesStore } = require("@/store/useRatesStore");
    expect(useRatesStore.persist.hasHydrated()).toBe(false);
    await useRatesStore.getState().syncRates();
    expect(fetchMock).not.toHaveBeenCalled();
    // The early call must not have nulled the rates on disk.
    expect(
      JSON.parse((await asyncStorage().getItem("exchange_rates")) ?? "").state
        .rates
    ).toEqual({ EUR: 0.9 });

    await flush();
    expect(useRatesStore.persist.hasHydrated()).toBe(true);
    await useRatesStore.getState().syncRates();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useRatesStore.getState().rates).toEqual({ EUR: 0.9 });
  });
});
