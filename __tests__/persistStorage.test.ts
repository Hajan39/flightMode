import { create } from "zustand";
import { persist, type StateStorage } from "zustand/middleware";

import { resetHydrationFailures, runAfterHydration } from "@/utils/hydration";
import { safePersistOptions } from "@/utils/persistStorage";

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
  return create<CounterState>()(
    persist(
      (set) => ({
        bump: () => set((s) => ({ count: s.count + 1 })),
        count: 0,
        label: "default",
      }),
      safePersistOptions(() => backend.storage, { name })
    )
  );
}

const stored = (count: number, label = "saved") =>
  JSON.stringify({ state: { count, label }, version: 0 });

const flush = async (times = 20) => {
  for (let i = 0; i < times; i += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: draining the microtask queue on purpose
    await Promise.resolve();
  }
};

beforeEach(() => {
  resetHydrationFailures();
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

  test("a failed read blocks writes for the session, so data on disk survives", async () => {
    const backend = memoryBackend({ "demo-broken": stored(99) });
    backend.failReads = 2; // first read + its retry
    const store = makeStore(backend, "demo-broken");
    const outcome = jest.fn();
    runAfterHydration(store, outcome, { timeoutMs: 60_000 });
    await flush();

    expect(store.persist.hasHydrated()).toBe(false);
    expect(outcome).toHaveBeenCalledWith({ hydrated: false }); // reported
    store.getState().bump();
    store.setState({ label: "defaults-would-win" });
    await flush();
    expect(backend.data.get("demo-broken")).toBe(stored(99));
    expect(backend.writes).toBe(0);
  });

  test("a single transient read error is retried", async () => {
    const backend = memoryBackend({ demo: stored(7) });
    backend.failReads = 1;
    const store = makeStore(backend);
    await flush();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().count).toBe(7);
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
