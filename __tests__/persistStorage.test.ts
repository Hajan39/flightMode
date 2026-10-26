jest.mock("@/utils/analytics", () => ({
  ...jest.requireActual("@/utils/analytics"),
  captureAnalyticsEvent: jest.fn(),
}));

import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";

import { captureAnalyticsEvent } from "@/utils/analytics";
import { resetHydrationFailures, runAfterHydration } from "@/utils/hydration";
import {
  enablePersistRecovery,
  hasPersistRecovery,
  RECOVERY_DELAY_MS,
  safePersistOptions,
} from "@/utils/persistStorage";

/** In-memory string storage whose reads can be held back or made to fail. */
function memoryBackend(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let release: () => void = () => undefined;
  let gate: Promise<void> = Promise.resolve();
  const backend = {
    data,
    failReads: 0,
    /** Hold every getItem until `release()` (a slow 2.5 MB read). */
    hold() {
      gate = new Promise((r) => {
        release = r;
      });
    },
    release: () => release(),
    storage: {
      getItem: async (name: string) => {
        await gate;
        if (backend.failReads > 0) {
          backend.failReads -= 1;
          throw new Error("I/O error");
        }
        return data.get(name) ?? null;
      },
      removeItem: (name: string) => {
        data.delete(name);
        return Promise.resolve();
      },
      setItem: (name: string, value: string) => {
        backend.writes += 1;
        data.set(name, value);
        return Promise.resolve();
      },
    } satisfies StateStorage,
    writes: 0,
  };
  return backend;
}

interface CounterState {
  bump: () => void;
  count: number;
  label: string;
}

function makeStore(backend: ReturnType<typeof memoryBackend>, name = "demo") {
  const store = create<CounterState>()(
    persist(
      (set) => ({
        bump: () => set((s) => ({ count: s.count + 1 })),
        count: 0,
        label: "default",
      }),
      safePersistOptions(() => backend.storage, { name })
    )
  );
  return enablePersistRecovery(store);
}

const stored = (count: number, label = "saved") =>
  JSON.stringify({ state: { count, label }, version: 0 });

const flush = async (times = 20) => {
  for (let i = 0; i < times; i += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: draining the microtask queue on purpose
    await Promise.resolve();
  }
};

/** Read retries back off 100 / 400 / 1000 ms. */
const RETRY_TOTAL_MS = 100 + 400 + 1000;

beforeEach(() => {
  resetHydrationFailures();
  (captureAnalyticsEvent as jest.Mock).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("guarded persist storage", () => {
  test("a set() before hydration does not overwrite the stored data", async () => {
    const backend = memoryBackend({ demo: stored(41) });
    backend.hold();
    const store = makeStore(backend);

    store.getState().bump(); // pre-hydration write (zustand writes full state)
    await flush();
    expect(store.persist.hasHydrated()).toBe(false);
    expect(backend.data.get("demo")).toBe(stored(41)); // untouched
    expect(backend.writes).toBe(0);

    backend.release();
    await flush();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().count).toBe(41);
    // Post-hydration state equals what was read → no needless rewrite.
    expect(backend.writes).toBe(0);

    store.getState().bump();
    await flush();
    expect(JSON.parse(backend.data.get("demo") ?? "").state.count).toBe(42);
  });

  test("fresh install: a pre-hydration change is persisted by the post-hydration write", async () => {
    const backend = memoryBackend();
    backend.hold();
    const store = makeStore(backend);
    store.getState().bump();
    await flush();
    expect(backend.data.has("demo")).toBe(false);
    backend.release();
    await flush();
    expect(store.getState().count).toBe(1);
    expect(JSON.parse(backend.data.get("demo") ?? "").state.count).toBe(1);
  });

  test("identical rewrites are skipped", async () => {
    const backend = memoryBackend();
    const store = makeStore(backend);
    await flush();
    const before = backend.writes;
    store.setState({ label: "x" });
    store.setState({ label: "x" });
    store.setState({ label: "x" });
    await flush();
    expect(backend.writes).toBe(before + 1);
  });

  test("corrupt JSON is backed up to <name>.corrupt before anything is written", async () => {
    const backend = memoryBackend({ demo: '{"state":{"count":4' });
    const store = makeStore(backend);
    await flush();
    expect(backend.data.get("demo.corrupt")).toBe('{"state":{"count":4');
    // Recovers with defaults and keeps working.
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().count).toBe(0);
    store.getState().bump();
    await flush();
    expect(JSON.parse(backend.data.get("demo") ?? "").state.count).toBe(1);
    expect(backend.data.get("demo.corrupt")).toBe('{"state":{"count":4');
  });

  test("a failed read blocks writes, so data on disk survives", async () => {
    jest.useFakeTimers();
    const backend = memoryBackend({ "demo-broken": stored(99) });
    backend.failReads = 4; // first read + 3 retries
    const store = makeStore(backend, "demo-broken");
    const outcome = jest.fn();
    runAfterHydration(store, outcome, { timeoutMs: 60_000 });
    await jest.advanceTimersByTimeAsync(RETRY_TOTAL_MS);

    expect(store.persist.hasHydrated()).toBe(false);
    expect(store.persist.getOptions().storage?.gate()).toBe("blocked");
    expect(outcome).toHaveBeenCalledWith({ hydrated: false }); // reported
    expect(captureAnalyticsEvent).toHaveBeenCalledWith("storage_read_blocked", {
      store: "demo-broken",
    });
    store.getState().bump();
    store.setState({ label: "defaults-would-win" });
    await flush();
    expect(backend.data.get("demo-broken")).toBe(stored(99));
    expect(backend.writes).toBe(0);
  });

  test("read errors are retried with backoff", async () => {
    jest.useFakeTimers();
    const backend = memoryBackend({ demo: stored(7) });
    backend.failReads = 3;
    const store = makeStore(backend);
    await jest.advanceTimersByTimeAsync(100 + 400);
    expect(store.persist.hasHydrated()).toBe(false); // still backing off
    expect(backend.failReads).toBe(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().count).toBe(7);
    expect(captureAnalyticsEvent).not.toHaveBeenCalled();
  });

  test("the background re-read after a block reopens writes", async () => {
    jest.useFakeTimers();
    const backend = memoryBackend({ "demo-recover": stored(5) });
    backend.failReads = 4;
    const store = makeStore(backend, "demo-recover");
    await jest.advanceTimersByTimeAsync(RETRY_TOTAL_MS);
    expect(store.persist.getOptions().storage?.gate()).toBe("blocked");

    await jest.advanceTimersByTimeAsync(RECOVERY_DELAY_MS);
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().count).toBe(5);
    expect(store.persist.getOptions().storage?.gate()).toBe("open");
    store.getState().bump();
    await flush();
    expect(JSON.parse(backend.data.get("demo-recover") ?? "").state.count).toBe(
      6
    );
  });

  test("a manual rehydrate after a block reopens writes", async () => {
    jest.useFakeTimers();
    const backend = memoryBackend({ "demo-manual": stored(5) });
    backend.failReads = 4;
    const store = makeStore(backend, "demo-manual");
    await jest.advanceTimersByTimeAsync(RETRY_TOTAL_MS);
    expect(store.persist.getOptions().storage?.gate()).toBe("blocked");
    await store.persist.rehydrate();
    expect(store.getState().count).toBe(5);
    store.getState().bump();
    await flush();
    expect(store.persist.getOptions().storage?.gate()).toBe("open");
    expect(JSON.parse(backend.data.get("demo-manual") ?? "").state.count).toBe(
      6
    );
  });

  test("only one background re-read per session", async () => {
    jest.useFakeTimers();
    const backend = memoryBackend({ "demo-once": stored(5) });
    backend.failReads = 100; // the disk stays unreadable
    const store = makeStore(backend, "demo-once");
    await jest.advanceTimersByTimeAsync(RETRY_TOTAL_MS);
    const readsLeft = backend.failReads;
    await jest.advanceTimersByTimeAsync(RECOVERY_DELAY_MS + RETRY_TOTAL_MS);
    expect(backend.failReads).toBe(readsLeft - 4); // one re-read, 4 attempts
    await jest.advanceTimersByTimeAsync(
      10 * (RECOVERY_DELAY_MS + RETRY_TOTAL_MS)
    );
    expect(backend.failReads).toBe(readsLeft - 4);
    expect(store.persist.getOptions().storage?.gate()).toBe("blocked");
    expect(backend.data.get("demo-once")).toBe(stored(5));
    expect(captureAnalyticsEvent).toHaveBeenCalledTimes(2); // both blocks
  });

  test("chains the store's own onRehydrateStorage and merge", async () => {
    const backend = memoryBackend({ chained: stored(3) });
    const after = jest.fn();
    const store = create<CounterState>()(
      persist(
        (set) => ({
          bump: () => set((s) => ({ count: s.count + 1 })),
          count: 0,
          label: "default",
        }),
        safePersistOptions(() => backend.storage, {
          merge: (persisted, current) => ({
            ...current,
            ...(persisted as Partial<CounterState>),
            label: "merged",
          }),
          name: "chained",
          onRehydrateStorage: () => after,
        })
      )
    );
    await flush();
    expect(store.getState()).toMatchObject({ count: 3, label: "merged" });
    expect(after).toHaveBeenCalledTimes(1);
    // The merged change is persisted by the post-hydration write.
    expect(JSON.parse(backend.data.get("chained") ?? "").state.label).toBe(
      "merged"
    );
  });
});

describe("every persisted store uses the guarded storage", () => {
  test.each([
    ["@/store/useAchievementStore", "useAchievementStore"],
    ["@/store/useChecklistStore", "useChecklistStore"],
    ["@/store/useContentStore", "useContentStore"],
    ["@/store/useDiscoveryStore", "useDiscoveryStore"],
    ["@/store/useFlightStore", "useFlightStore"],
    ["@/store/useGameStore", "useGameStore"],
    ["@/store/useImageCacheStore", "useImageCacheStore"],
    ["@/store/usePlayersStore", "usePlayersStore"],
    ["@/store/useRatesStore", "useRatesStore"],
    ["@/store/useSettingsStore", "useSettingsStore"],
    ["@/store/useSupporterStore", "useSupporterStore"],
  ])("%s", (path, exportName) => {
    const store = require(path)[exportName];
    const options = store.persist.getOptions();
    expect(typeof options.storage.gate).toBe("function");
    expect(typeof options.onRehydrateStorage).toBe("function");
    expect(hasPersistRecovery(options.name)).toBe(true);
  });

  test("useGameStore reports a failed read to hydration waiters", () => {
    // The wrapper's onRehydrateStorage marks the failure by store name.
    const { useGameStore } = require("@/store/useGameStore");
    const post = useGameStore.persist
      .getOptions()
      .onRehydrateStorage?.(useGameStore.getState());
    const waiter = jest.fn();
    runAfterHydration(
      {
        persist: {
          getOptions: () => ({ name: "game_progress" }),
          hasHydrated: () => false,
          onFinishHydration: () => () => undefined,
        },
      },
      waiter,
      { timeoutMs: 60_000 }
    );
    post?.(undefined, new Error("read failed"));
    expect(waiter).toHaveBeenCalledWith({ hydrated: false });
  });
});
