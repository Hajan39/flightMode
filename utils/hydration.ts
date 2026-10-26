/** The slice of zustand's `persist` API needed to wait for hydration. */
interface PersistApi {
  getOptions?: () => { name?: string };
  hasHydrated: () => boolean;
  onFinishHydration: (listener: () => void) => () => void;
}

/**
 * zustand persist never marks a store hydrated (nor calls
 * `onFinishHydration`) when the storage read throws or the JSON is corrupt.
 * Stores report that through `onRehydrateStorage: reportHydrationResult(name)`
 * so waiters don't stall forever; a timeout covers stores that don't report.
 */
const failedStores = new Set<string>();
const failureListeners = new Map<string, Set<() => void>>();

export const HYDRATION_TIMEOUT_MS = 3000;

/** Marks the persisted store `name` as failed to hydrate; wakes its waiters. */
export function markHydrationFailed(name: string) {
  failedStores.add(name);
  const listeners = failureListeners.get(name);
  if (!listeners) {
    return;
  }
  for (const listener of [...listeners]) {
    listener();
  }
}

/**
 * `onRehydrateStorage` value for a persisted store:
 * `onRehydrateStorage: reportHydrationResult("settings")`. Chain an existing
 * post-rehydration callback via `then`.
 */
export function reportHydrationResult<S>(
  name: string,
  then?: (state: S | undefined, error: unknown) => void
) {
  return () => (state: S | undefined, error: unknown) => {
    if (error) {
      markHydrationFailed(name);
    }
    then?.(state, error);
  };
}

/** Test helper. */
export function resetHydrationFailures() {
  failedStores.clear();
  failureListeners.clear();
}

export interface RunAfterHydrationOptions {
  /**
   * Run anyway after this many ms if hydration never finishes (failed read).
   * `null` disables the fallback — for decisions that must use the real
   * persisted values (e.g. the analytics opt-out).
   */
  timeoutMs?: number | null;
}

export interface HydrationOutcome {
  /** false when `fn` ran because of a reported failure or the timeout. */
  hydrated: boolean;
}

/**
 * Runs `fn` once the persisted store has loaded from AsyncStorage (right away
 * if it already has). Writing to a persisted store before hydration is lost:
 * zustand persist merges the stored state over it. If hydration fails (reported
 * via `reportHydrationResult`) or takes longer than `timeoutMs`, `fn` still runs
 * once, with `{ hydrated: false }`. Returns a cleanup that cancels a still-pending call.
 */
export function runAfterHydration(
  store: { persist: PersistApi },
  fn: (outcome: HydrationOutcome) => void,
  options: RunAfterHydrationOptions = {}
): () => void {
  if (store.persist.hasHydrated()) {
    fn({ hydrated: true });
    return () => undefined;
  }
  const name = store.persist.getOptions?.().name;
  const timeoutMs =
    options.timeoutMs === undefined ? HYDRATION_TIMEOUT_MS : options.timeoutMs;
  const failureFallback = timeoutMs !== null;

  if (failureFallback && name && failedStores.has(name)) {
    fn({ hydrated: false });
    return () => undefined;
  }

  let done = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeFailure: (() => void) | null = null;

  const cleanup = () => {
    done = true;
    unsubscribe();
    unsubscribeFailure?.();
    if (timer !== null) {
      clearTimeout(timer);
    }
  };
  const finish = (hydrated: boolean) => {
    if (done) {
      return;
    }
    cleanup();
    fn({ hydrated });
  };

  const unsubscribe = store.persist.onFinishHydration(() => finish(true));

  if (failureFallback) {
    if (name) {
      const listener = () => finish(false);
      let set = failureListeners.get(name);
      if (!set) {
        set = new Set();
        failureListeners.set(name, set);
      }
      set.add(listener);
      const listeners = set;
      unsubscribeFailure = () => listeners.delete(listener);
    }
    timer = setTimeout(() => finish(store.persist.hasHydrated()), timeoutMs);
  }

  return cleanup;
}
