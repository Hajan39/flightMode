/**
 * Model-based property tests for the guarded zustand storage
 * (utils/persistStorage.ts createGuardedStorage): random interleavings of
 * reads, writes, removes and backend failures against an in-memory fake
 * backend, checked after every step against a tiny reference model.
 */
jest.mock("@/utils/analytics", () => ({
  ...jest.requireActual("@/utils/analytics"),
  captureAnalyticsEvent: jest.fn(),
}));

import type { StateStorage, StorageValue } from "zustand/middleware";

import { createGuardedStorage } from "@/utils/persistStorage";

import { assert, forAllAsync, type Gen } from "./helpers/property";

const NAME = "store";

interface FakeBackend {
  data: Map<string, string>;
  /** Outcome of the next backend calls: true = throw. Empty = succeed. */
  failNext: boolean[];
  storage: StateStorage;
}

/** In-memory backend; every call settles after one microtask, in order. */
function fakeBackend(initial: string | null): FakeBackend {
  const data = new Map<string, string>();
  if (initial !== null) {
    data.set(NAME, initial);
  }
  const backend: FakeBackend = {
    data,
    failNext: [],
    storage: {
      getItem: async (name) => {
        await Promise.resolve();
        if (backend.failNext.shift()) {
          throw new Error("read failed");
        }
        return data.get(name) ?? null;
      },
      removeItem: async (name) => {
        await Promise.resolve();
        if (backend.failNext.shift()) {
          throw new Error("remove failed");
        }
        data.delete(name);
      },
      setItem: async (name, text) => {
        await Promise.resolve();
        if (backend.failNext.shift()) {
          throw new Error("write failed");
        }
        data.set(name, text);
      },
    },
  };
  return backend;
}

type Value = StorageValue<{ n: number }>;
const value = (n: number): Value => ({ state: { n }, version: 0 });
const raw = (n: number) => JSON.stringify(value(n));

/** Small value pool so identical consecutive writes (the skip path) are common. */
const pickN = (g: Gen) => g.int(0, 3);

describe("guarded persist storage — model-based", () => {
  test("sequential get/set/remove/fail interleavings never lose an acknowledged write (1500 runs × ≤40 ops)", async () => {
    await forAllAsync("guarded sequential", 1500, async (g) => {
      const initialN = g.bool(0.7) ? pickN(g) : null;
      let initial: string | null = null;
      if (initialN !== null) {
        initial = g.bool(0.1) ? "{corrupt" : raw(initialN);
      }
      const backend = fakeBackend(initial);
      const storage = createGuardedStorage<{ n: number }>(backend.storage, {
        retryDelaysMs: [],
      });
      const disk = () => backend.data.get(NAME) ?? null;
      const ops = g.int(1, 40);
      const log: string[] = [];
      for (let i = 0; i < ops; i += 1) {
        const op = g.pick(["set", "set", "set", "get", "remove", "failSet"]);
        const before = disk();
        const gate = storage.gate();
        if (op === "get") {
          const fail = g.bool(0.3);
          backend.failNext = [fail];
          log.push(`get${fail ? "!" : ""}`);
          let threw = false;
          let got: Value | null = null;
          try {
            // biome-ignore lint/performance/noAwaitInLoops: the model steps one op at a time
            got = (await storage.getItem(NAME)) as Value | null;
          } catch {
            threw = true;
          }
          assert(threw === fail, `get threw=${threw} fail=${fail}`);
          if (threw) {
            assert(storage.gate() === "blocked", "failed read did not block");
          } else {
            // Like zustand's merge: open writes once the stored state is in hand.
            storage.open();
            let parsedDisk: unknown = null;
            try {
              parsedDisk = before === null ? null : JSON.parse(before);
            } catch {
              parsedDisk = null;
            }
            expect(got).toEqual(parsedDisk);
          }
          continue;
        }
        if (op === "remove") {
          log.push("remove");
          backend.failNext = [];
          await storage.removeItem(NAME);
          const expected = gate === "open" ? null : before;
          assert(
            disk() === expected,
            `remove: disk ${disk()} (gate ${gate}) | ${log.join(" ")}`
          );
          continue;
        }
        const n = pickN(g);
        const fail = op === "failSet";
        backend.failNext = [fail];
        log.push(`${fail ? "failSet" : "set"}(${n})`);
        await storage.setItem(NAME, value(n));
        backend.failNext = [];
        if (gate !== "open") {
          assert(
            disk() === before,
            `write leaked through gate ${gate} | ${log.join(" ")}`
          );
        } else if (fail) {
          assert(
            disk() === before,
            `failed write changed disk | ${log.join(" ")}`
          );
        } else {
          // The heart of it: an acknowledged write (incl. a skipped
          // identical one) means the disk holds exactly this value.
          assert(
            disk() === raw(n),
            `set(${n}) acknowledged but disk = ${disk()} | ${log.join(" ")}`
          );
        }
      }
    });
  });

  test("concurrent writes: after they settle, a final successful write is on disk (1500 runs)", async () => {
    await forAllAsync("guarded concurrent final", 1500, async (g) => {
      const backend = fakeBackend(raw(0));
      const storage = createGuardedStorage<{ n: number }>(backend.storage, {
        retryDelaysMs: [],
      });
      await storage.getItem(NAME);
      storage.open();
      const burst = g.int(1, 6);
      backend.failNext = Array.from({ length: burst }, () => g.bool(0.4));
      const pending = Array.from({ length: burst }, () =>
        storage.setItem(NAME, value(pickN(g)))
      );
      await Promise.all(pending);
      backend.failNext = [];
      const n = pickN(g);
      await storage.setItem(NAME, value(n));
      expect(backend.data.get(NAME)).toBe(raw(n));
    });
  });

  // Formerly a KNOWN BUG (fixed in review round 8): the identical-rewrite
  // skip compared against the value last *sent*, so a duplicate issued while
  // an equal write was in flight was skipped, and lost if that write failed.
  // Now only confirmed results count as "on disk", a duplicate folded into
  // an in-flight write keeps its attempt in reserve and is retried.
  test("concurrent writes: the last requested value wins whenever the final backend call succeeds, and one more write always lands it (property)", async () => {
    await forAllAsync("guarded concurrent last-wins", 1500, async (g) => {
      const backend = fakeBackend(raw(0));
      const storage = createGuardedStorage<{ n: number }>(backend.storage, {
        retryDelaysMs: [],
      });
      await storage.getItem(NAME);
      storage.open();
      const burst = Array.from({ length: g.int(2, 6) }, () => pickN(g));
      // Random outcome per backend call (dedup may issue fewer calls).
      const outcomes = burst.map(() => g.bool(0.5));
      backend.failNext = [...outcomes];
      await Promise.all(burst.map((n) => storage.setItem(NAME, value(n))));
      const calls = outcomes.length - backend.failNext.length;
      const last = burst.at(-1) as number;
      if (calls > 0 && !outcomes[calls - 1]) {
        expect(backend.data.get(NAME)).toBe(raw(last));
      }
      // Whatever happened, repeating the last value is not skipped wrongly.
      backend.failNext = [];
      await storage.setItem(NAME, value(last));
      expect(backend.data.get(NAME)).toBe(raw(last));
    });
  });

  test("regression (was KNOWN BUG): in-flight identical write fails → folded duplicate is retried → value kept", async () => {
    const backend = fakeBackend(raw(0));
    const storage = createGuardedStorage<{ n: number }>(backend.storage, {
      retryDelaysMs: [],
    });
    await storage.getItem(NAME);
    storage.open();
    backend.failNext = [true];
    const first = storage.setItem(NAME, value(1)); // in flight, will fail
    const second = storage.setItem(NAME, value(1)); // folded into the first
    await Promise.all([first, second]);
    expect(backend.data.get(NAME)).toBe(raw(1));
  });
});
