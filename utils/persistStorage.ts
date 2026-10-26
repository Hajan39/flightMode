import type {
  PersistOptions,
  PersistStorage,
  StateStorage,
  StorageValue,
} from "zustand/middleware";

import { markHydrationFailed } from "@/utils/hydration";

/**
 * Why this exists: zustand `persist` writes the full state on EVERY `set()`,
 * including the ones that happen before hydration finished. Such a write
 * replaces the real stored data with defaults (+ the early change); hydration
 * then puts the real data back in memory, but the disk keeps the defaults
 * until the next `set()`. If the app dies in between, the data is gone. And
 * after a failed read every later `set()` overwrites whatever was on disk.
 *
 * The guard below therefore keeps a per-store write gate:
 *
 * - `reading` (until hydration merged the stored state) → writes are DROPPED.
 *   Hydration overwrites the persisted keys in memory anyway. zustand itself
 *   does not write after hydrating (it uses the raw `set`), so
 *   `safePersistOptions` issues one write of the merged state once hydration
 *   finished: that persists early changes on a fresh install and fix-ups done
 *   by `merge`; when nothing changed the identical-write skip makes it free.
 *   The gate opens inside `merge`, i.e. after the stored state is in hand and
 *   right before zustand's own post-migration write.
 * - corrupt JSON → the raw text is copied to `<name>.corrupt` (best effort),
 *   the store starts from defaults and writes are allowed: the data was
 *   unreadable anyway, the backup keeps it recoverable, and the app is usable.
 * - read threw (I/O error, also after one retry) → writes stay BLOCKED for
 *   the whole session. The file is probably intact (a transient or
 *   size-related read error), so overwriting it with defaults would be the
 *   destructive choice; losing this session's changes is the lesser evil. The
 *   failure is reported (`markHydrationFailed`) so waiters don't stall.
 *
 * Identical rewrites (repeated equal `set()`s, the post-hydration write of
 * unchanged data) are skipped — this matters for the multi-MB article feed.
 */

type Gate = "reading" | "open" | "blocked";

export interface GuardedStorage<S> extends PersistStorage<S> {
  /** Current gate state (tests / diagnostics). */
  gate: () => Gate;
  /** Opens writes; called by the wrapped `merge` once hydration merged. */
  open: () => void;
}

export function createGuardedStorage<S>(
  backend: StateStorage
): GuardedStorage<S> {
  let gate: Gate = "reading";
  /** Raw JSON last read from / written to the backend (skip identical rewrites). */
  let lastRaw: string | null | undefined;

  const readRaw = async (name: string) => {
    try {
      return await backend.getItem(name);
    } catch {
      // One retry: a cold-start read can fail transiently.
      return await backend.getItem(name);
    }
  };

  return {
    gate: () => gate,
    async getItem(name) {
      let raw: string | null;
      try {
        raw = await readRaw(name);
      } catch (error) {
        gate = "blocked";
        throw error;
      }
      if (raw === null || raw === undefined) {
        lastRaw = null;
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as StorageValue<S>;
        lastRaw = raw;
        return parsed;
      } catch {
        try {
          await backend.setItem(`${name}.corrupt`, raw);
        } catch {
          // Best effort: the store must still become usable.
        }
        lastRaw = undefined;
        return null;
      }
    },
    open: () => {
      if (gate === "reading") {
        gate = "open";
      }
    },
    async removeItem(name) {
      if (gate !== "open") {
        return;
      }
      lastRaw = null;
      await backend.removeItem(name);
    },
    async setItem(name, value) {
      if (gate !== "open") {
        return;
      }
      const raw = JSON.stringify(value);
      if (raw === lastRaw) {
        return;
      }
      lastRaw = raw;
      try {
        await backend.setItem(name, raw);
      } catch {
        // Unknown on-disk state: the next set() must not be skipped. Not
        // rethrown — zustand never awaits this promise (unhandled rejection).
        if (lastRaw === raw) {
          lastRaw = undefined;
        }
      }
    },
  };
}

type SafeOptions<S, P> = Omit<PersistOptions<S, P>, "storage"> & {
  name: string;
};

/**
 * `persist` options with the guarded storage wired in. Use for every
 * persisted store:
 *
 * ```ts
 * persist(creator, safePersistOptions(() => AsyncStorage, { name: "x" }))
 * ```
 *
 * Also reports hydration failures (`markHydrationFailed`) and chains an
 * existing `onRehydrateStorage` / `merge`.
 */
export function safePersistOptions<S, P = S>(
  backend: () => StateStorage,
  options: SafeOptions<S, P>
): PersistOptions<S, P> & { storage: GuardedStorage<P> } {
  const storage = createGuardedStorage<P>(backend());
  const innerMerge =
    options.merge ??
    ((persisted: unknown, current: S) =>
      ({ ...current, ...(persisted as object) }) as S);
  const innerRehydrate = options.onRehydrateStorage;
  return {
    ...options,
    merge: (persisted, current) => {
      const merged = innerMerge(persisted, current);
      storage.open();
      return merged;
    },
    onRehydrateStorage: (state) => {
      const post = innerRehydrate?.(state);
      return (hydrated, error) => {
        if (error || !hydrated) {
          markHydrationFailed(options.name);
        } else {
          // Persist the merged state (see the note at the top of this file).
          const partialize = options.partialize ?? ((s: S) => s as never);
          // biome-ignore lint/complexity/noVoid: fire-and-forget like zustand's own writes; setItem never rejects
          void storage.setItem(options.name, {
            state: partialize(hydrated),
            version: options.version ?? 0,
          });
        }
        post?.(hydrated, error);
      };
    },
    storage,
  };
}
