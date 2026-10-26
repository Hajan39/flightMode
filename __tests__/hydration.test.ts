import { runAfterHydration } from "@/utils/hydration";

function fakeStore(hydrated: boolean) {
  const listeners = new Set<() => void>();
  return {
    finish: () => {
      for (const l of [...listeners]) {
        l();
      }
    },
    listeners,
    persist: {
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
});
