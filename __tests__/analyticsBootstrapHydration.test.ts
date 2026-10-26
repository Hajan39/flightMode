/**
 * AnalyticsBootstrap counts the app open only after settings REALLY hydrated:
 * after a failed read, writing (defaults + 1) would wipe onboarding, language
 * and the analytics opt-out on disk.
 */
jest.mock("posthog-react-native", () => ({
  PostHogPersistedProperty: { Queue: "queue" },
  PostHogProvider: ({ children }: { children: unknown }) => children,
  usePostHog: () => ({}),
}));
jest.mock("@/utils/analytics", () => ({
  analyticsNetworkAllowsUpload: () => false,
  captureAnalyticsEvent: jest.fn(),
  disableAnalytics: jest.fn(),
  getAnalyticsUploadMode: () => "hold",
  restoreAnalyticsQueue: jest.fn(),
  setAnalyticsSink: jest.fn(),
}));

import type TestRendererType from "react-test-renderer";

let rt: {
  act: typeof import("react-test-renderer").act;
  create: typeof TestRendererType.create;
  createElement: typeof import("react").createElement;
};

function asyncStorage() {
  const mod = require("@react-native-async-storage/async-storage");
  return (mod.default ??
    mod) as typeof import("@react-native-async-storage/async-storage").default;
}

const SETTINGS = JSON.stringify({
  state: {
    analyticsEnabled: false,
    appOpenCount: 7,
    isFirstLaunch: false,
    language: "cs",
  },
  version: 0,
});

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  jest.resetModules();
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
  rt = {
    act: require("react-test-renderer").act,
    create: require("react-test-renderer").create,
    createElement: require("react").createElement,
  };
  await asyncStorage().setItem("settings", SETTINGS);
});

afterEach(() => {
  jest.useRealTimers();
});

async function renderBootstrap() {
  const { AnalyticsBootstrap } = require("@/components/AnalyticsProvider");
  let renderer: TestRendererType.ReactTestRenderer | null = null;
  await rt.act(() => {
    renderer = rt.create(rt.createElement(AnalyticsBootstrap));
  });
  await rt.act(async () => {
    await jest.advanceTimersByTimeAsync(10_000); // past the old 3 s fallback
  });
  return renderer as unknown as TestRendererType.ReactTestRenderer;
}

test("counts the open once settings hydrated", async () => {
  const renderer = await renderBootstrap();
  const { useSettingsStore } = require("@/store/useSettingsStore");
  expect(useSettingsStore.getState().appOpenCount).toBe(8);
  expect(
    JSON.parse((await asyncStorage().getItem("settings")) ?? "").state
  ).toMatchObject({ analyticsEnabled: false, appOpenCount: 8, language: "cs" });
  await rt.act(async () => renderer.unmount());
});

test("a failed settings read writes nothing, even after the timeout", async () => {
  const getItem = asyncStorage().getItem as jest.Mock;
  getItem.mockImplementation((key: string) =>
    key === "settings"
      ? Promise.reject(new Error("I/O error"))
      : Promise.resolve(null)
  );
  const renderer = await renderBootstrap();
  const { useSettingsStore } = require("@/store/useSettingsStore");
  expect(useSettingsStore.persist.hasHydrated()).toBe(false);
  expect(useSettingsStore.getState().appOpenCount).toBe(0); // not incremented
  getItem.mockReset();
  const raw = asyncStorage().__INTERNAL_MOCK_STORAGE__ as Record<
    string,
    string
  >;
  expect(raw.settings).toBe(SETTINGS);
  await rt.act(async () => renderer.unmount());
});
