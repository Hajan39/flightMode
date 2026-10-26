import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  HYDRATION_TIMEOUT_MS,
  markHydrationFailed,
  reportHydrationResult,
  resetHydrationFailures,
  runAfterHydration,
} from "@/utils/hydration";

function fakeStore(hydrated: boolean, name?: string) {
  const listeners = new Set<() => void>();
  return {
    finish: () => {
      for (const l of [...listeners]) {
        l();
      }
    },
    listeners,
    persist: {
      getOptions: () => ({ name }),
      hasHydrated: () => hydrated,
      onFinishHydration: (l: () => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
  };
}

describe("runAfterHydration", () => {
  test("runs immediately when already hydrated", () => {
    const fn = jest.fn();
    runAfterHydration(fakeStore(true), fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("waits for hydration and runs once", () => {
    const store = fakeStore(false);
    const fn = jest.fn();
    runAfterHydration(store, fn);
    expect(fn).not.toHaveBeenCalled();
    store.finish();
    store.finish();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.listeners.size).toBe(0);
  });

  test("cleanup cancels a pending call", () => {
    const store = fakeStore(false);
    const fn = jest.fn();
    runAfterHydration(store, fn)();
    store.finish();
    expect(fn).not.toHaveBeenCalled();
  });

  // zustand emits to a snapshot of its listener set, so a listener removed
  // mid-emit (or by a cleanup racing the emit) can still be invoked once.
  // The `done` flag must guard both paths, not just `unsubscribe()`.
  function leakyStore() {
    const listeners: Array<() => void> = [];
    return {
      finish: () => {
        for (const l of listeners) {
          l();
        }
      },
      persist: {
        hasHydrated: () => false,
        onFinishHydration: (l: () => void) => {
          listeners.push(l);
          return () => undefined; // removal does not take effect
        },
      },
    };
  }

  test("runs once even if the listener keeps being called after unsubscribe", () => {
    const store = leakyStore();
    const fn = jest.fn();
    runAfterHydration(store, fn);
    store.finish();
    store.finish();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("cleanup wins even if the listener is still invoked afterwards", () => {
    const store = leakyStore();
    const fn = jest.fn();
    runAfterHydration(store, fn)();
    store.finish();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("runAfterHydration failure fallbacks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetHydrationFailures();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("runs once after the timeout when hydration never finishes", () => {
    const store = fakeStore(false);
    const fn = jest.fn();
    runAfterHydration(store, fn);
    jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS - 1);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith({ hydrated: false });
    // A late finish does not run it again.
    store.finish();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(store.listeners.size).toBe(0);
  });

  test("a normal finish cancels the timeout", () => {
    const store = fakeStore(false);
    const fn = jest.fn();
    runAfterHydration(store, fn);
    store.finish();
    jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS * 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ hydrated: true });
  });

  test("a reported failure resolves waiters right away", () => {
    const store = fakeStore(false, "settings");
    const fn = jest.fn();
    runAfterHydration(store, fn);
    markHydrationFailed("settings");
    expect(fn).toHaveBeenCalledWith({ hydrated: false });
    jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("an already-failed store runs new waiters immediately", () => {
    markHydrationFailed("achievements");
    const fn = jest.fn();
    runAfterHydration(fakeStore(false, "achievements"), fn);
    expect(fn).toHaveBeenCalledWith({ hydrated: false });
  });

  test("timeoutMs: null waits for the real hydration only", () => {
    markHydrationFailed("settings");
    const store = fakeStore(false, "settings");
    const fn = jest.fn();
    runAfterHydration(store, fn, { timeoutMs: null });
    jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS * 10);
    expect(fn).not.toHaveBeenCalled();
    store.finish();
    expect(fn).toHaveBeenCalledWith({ hydrated: true });
  });

  test("cleanup also cancels the timeout", () => {
    const fn = jest.fn();
    runAfterHydration(fakeStore(false), fn)();
    jest.advanceTimersByTime(HYDRATION_TIMEOUT_MS);
    expect(fn).not.toHaveBeenCalled();
  });

  test("zustand persist with a throwing storage reports the failure", async () => {
    jest.useRealTimers();
    const store = create<{ n: number }>()(
      persist(() => ({ n: 0 }), {
        name: "broken-store",
        onRehydrateStorage: reportHydrationResult("broken-store"),
        storage: createJSONStorage(() => ({
          getItem: () => Promise.reject(new Error("disk full")),
          removeItem: () => Promise.resolve(),
          setItem: () => Promise.resolve(),
        })),
      })
    );
    const fn = jest.fn();
    const done = new Promise<void>((resolve) => {
      runAfterHydration(
        store,
        (outcome) => {
          fn(outcome);
          resolve();
        },
        { timeoutMs: 60_000 }
      );
    });
    await done;
    expect(store.persist.hasHydrated()).toBe(false);
    expect(fn).toHaveBeenCalledWith({ hydrated: false });
  });
});
