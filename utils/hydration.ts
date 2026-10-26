/** The slice of zustand's `persist` API needed to wait for hydration. */
interface PersistApi {
  hasHydrated: () => boolean;
  onFinishHydration: (listener: () => void) => () => void;
}

/**
 * Runs `fn` once the persisted store has loaded from AsyncStorage (right away
 * if it already has). Writing to a persisted store before hydration is lost:
 * zustand persist merges the stored state over it. Returns a cleanup that
 * cancels a still-pending call.
 */
export function runAfterHydration(
  store: { persist: PersistApi },
  fn: () => void
): () => void {
  if (store.persist.hasHydrated()) {
    fn();
    return () => undefined;
  }
  let done = false;
  const unsubscribe = store.persist.onFinishHydration(() => {
    if (done) {
      return;
    }
    done = true;
    unsubscribe();
    fn();
  });
  return () => {
    done = true;
    unsubscribe();
  };
}
