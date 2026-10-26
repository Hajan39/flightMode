import type {
  PersistOptions,
  PersistStorage,
  StateStorage,
  StorageValue,
} from "zustand/middleware";

import { captureAnalyticsEvent } from "@/utils/analytics";
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
 * - read threw (I/O error, also after retries with backoff) → writes are
 *   BLOCKED. The file is probably intact (a transient or size-related read
 *   error), so overwriting it with defaults would be the destructive choice;
 *   losing changes is the lesser evil. The failure is reported
 *   (`markHydrationFailed`) so waiters don't stall, and captured as
 *   `storage_read_blocked` (store name only). One background
 *   `persist.rehydrate()` is scheduled per session (stores register it via
 *   `enablePersistRecovery`); every new read resets `blocked` → `reading`,
 *   so a successful re-read opens writes again.
 * - …unless a write was dropped while blocked: then the in-memory state holds
 *   changes made this session (on top of defaults) and the re-read would
 *   silently replace them with the stored state. Layering the in-memory state
 *   over the re-read instead is not safe generically: whole-map keys (e.g.
 *   game progress) would replace every stored entry with this session's few,
 *   destroying the intact file. So the background re-read is SKIPPED for such
 *   a store: memory keeps the session's changes, the file stays untouched and
 *   the next launch reads it normally (only this session's changes are lost,
 *   as documented above). A manual `persist.rehydrate()` still works.
 *   Callers that must act this session (billing) learn that the store will
 *   not hydrate via `onPersistRecoveryGaveUp` (also fired when the re-read
 *   itself fails).
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
  /** True once a write/remove was dropped while the gate was `blocked`. */
  wroteWhileBlocked: () => boolean;
}

/** Waits before each read retry (cold-start reads can fail transiently). */
export const READ_RETRY_DELAYS_MS: readonly number[] = [100, 400, 1000];

/** Delay before the one background re-read after a blocked hydration. */
export const RECOVERY_DELAY_MS = 5000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export function createGuardedStorage<S>(
  backend: StateStorage,
  { retryDelaysMs = READ_RETRY_DELAYS_MS } = {}
): GuardedStorage<S> {
  let gate: Gate = "reading";
  /**
   * Raw JSON last read from / successfully written to the backend;
   * `undefined` = on-disk state unknown. Only confirmed results land here,
   * never a value whose write is still in flight.
   */
  let lastRaw: string | null | undefined;
  /** Latest value handed to the backend (`null` = remove). */
  let wantedRaw: string | null | undefined;
  /** Backend writes/removes issued but not settled yet. */
  let inFlight = 0;
  /** Sequence number of the latest issued write/remove. */
  let latestSeq = 0;
  /**
   * Identical writes folded into an in-flight write of the same value. Each
   * keeps its backend attempt in reserve: if the writes settle without the
   * latest value on disk (an in-flight write failed), the reserve is spent
   * retrying it, so a folded duplicate is never silently lost. Cleared once
   * the latest value is confirmed on disk.
   */
  let reserved = 0;

  /** One backend call; resolves with its error (undefined = success). */
  const backendWrite = async (name: string, raw: string | null) => {
    latestSeq += 1;
    const seq = latestSeq;
    wantedRaw = raw;
    inFlight += 1;
    try {
      if (raw === null) {
        await backend.removeItem(name);
      } else {
        await backend.setItem(name, raw);
      }
      if (seq === latestSeq) {
        lastRaw = raw;
      }
    } catch (error) {
      // Unknown on-disk state: the next set() must not be skipped.
      lastRaw = undefined;
      return error ?? new Error("storage write failed");
    } finally {
      inFlight -= 1;
    }
  };

  /** Issues a write, then (once all writes settled) spends the reserve. */
  const write = async (name: string, raw: string | null) => {
    const error = await backendWrite(name, raw);
    while (
      inFlight === 0 &&
      reserved > 0 &&
      wantedRaw !== undefined &&
      lastRaw !== wantedRaw
    ) {
      reserved -= 1;
      // biome-ignore lint/performance/noAwaitInLoops: retries are sequential by definition
      await backendWrite(name, wantedRaw);
    }
    if (inFlight === 0 && lastRaw === wantedRaw) {
      reserved = 0;
    }
    return error;
  };

  /** A change made in memory while blocked (see `wroteWhileBlocked`). */
  let droppedWhileBlocked = false;
  const dropped = () => {
    if (gate === "blocked") {
      droppedWhileBlocked = true;
    }
  };

  const readRaw = async (name: string) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: retries are sequential by definition
        return await backend.getItem(name);
      } catch (error) {
        const delay = retryDelaysMs[attempt];
        if (delay === undefined) {
          throw error;
        }
        await sleep(delay);
      }
    }
  };

  return {
    gate: () => gate,
    async getItem(name) {
      // A new read (e.g. the recovery rehydrate) gets a fresh chance: writes
      // stay dropped until it merged, then `open()` opens them.
      if (gate === "blocked") {
        gate = "reading";
      }
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
        dropped();
        return;
      }
      const error = await write(name, null);
      if (error !== undefined) {
        throw error;
      }
    },
    async setItem(name, value) {
      if (gate !== "open") {
        dropped();
        return;
      }
      const raw = JSON.stringify(value);
      if (inFlight === 0 ? raw === lastRaw : raw === wantedRaw) {
        // Identical to the confirmed disk state, or folded into the
        // in-flight write of the same value (its attempt goes to the
        // reserve, see `reserved`).
        if (inFlight > 0) {
          reserved += 1;
        }
        return;
      }
      // Never rejects — zustand never awaits this promise (unhandled
      // rejection); a failure leaves the on-disk state marked unknown.
      await write(name, raw);
    },
    wroteWhileBlocked: () => droppedWhileBlocked,
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
 * existing `onRehydrateStorage` / `merge`. Call `enablePersistRecovery(store)`
 * right after `create()` so a blocked read gets its background re-read.
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
  let recovery: "none" | "scheduled" | "running" | "done" = "none";
  const onBlocked = () => {
    captureAnalyticsEvent("storage_read_blocked", { store: options.name });
    if (recovery === "running") {
      // The background re-read failed too: no hydration this session.
      recovery = "done";
      markRecoveryGaveUp(options.name);
      return;
    }
    if (recovery !== "none") {
      return; // one background attempt per session — no retry loop
    }
    recovery = "scheduled";
    setTimeout(() => {
      const rehydrate = recoveries.get(options.name);
      if (!rehydrate || storage.wroteWhileBlocked()) {
        // Skipped: re-reading would discard this session's in-memory
        // changes (see the note at the top of this file).
        recovery = "done";
        markRecoveryGaveUp(options.name);
        return;
      }
      recovery = "running";
      // biome-ignore lint/complexity/noVoid: background attempt; its failure is handled by onRehydrateStorage
      void Promise.resolve(rehydrate()).catch(() => undefined);
    }, RECOVERY_DELAY_MS);
  };
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
          if (storage.gate() === "blocked") {
            onBlocked();
          }
        } else {
          if (recovery === "running") {
            recovery = "done";
          }
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

/** `persist.rehydrate` per store name, registered by `enablePersistRecovery`. */
const recoveries = new Map<string, () => unknown>();

/**
 * Lets `safePersistOptions` re-read a store in the background after its read
 * was blocked (the options object never sees the store api). Call once per
 * persisted store, right after `create()`. Returns the store.
 */
export function enablePersistRecovery<
  T extends {
    persist: { getOptions: () => { name?: string }; rehydrate: () => unknown };
  },
>(store: T): T {
  const { name } = store.persist.getOptions();
  if (name) {
    recoveries.set(name, () => store.persist.rehydrate());
  }
  return store;
}

/** Stores whose background recovery failed or was skipped this session. */
const gaveUp = new Set<string>();
const gaveUpListeners = new Map<string, Set<() => void>>();

function markRecoveryGaveUp(name: string) {
  gaveUp.add(name);
  const listeners = gaveUpListeners.get(name);
  gaveUpListeners.delete(name);
  for (const listener of listeners ?? []) {
    listener();
  }
}

/**
 * Calls `fn` once it is certain that the blocked store `name` will not
 * hydrate this session (its background re-read failed or was skipped) —
 * right away if that is already known. Returns an unsubscribe.
 */
export function onPersistRecoveryGaveUp(
  name: string,
  fn: () => void
): () => void {
  if (gaveUp.has(name)) {
    fn();
    return () => undefined;
  }
  let set = gaveUpListeners.get(name);
  if (!set) {
    set = new Set();
    gaveUpListeners.set(name, set);
  }
  set.add(fn);
  const listeners = set;
  return () => {
    listeners.delete(fn);
  };
}

/** Test helper: forget recovery give-ups. */
export function resetPersistRecoveryGaveUp() {
  gaveUp.clear();
  gaveUpListeners.clear();
}

/** Tests / diagnostics: whether `name` has a registered recovery. */
export function hasPersistRecovery(name: string): boolean {
  return recoveries.has(name);
}
