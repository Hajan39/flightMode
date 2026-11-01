import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorldQuestion } from "@/data/worldQuiz";
import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { fileStorage } from "@/utils/fileStorage";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";
import {
  fetchQuizIndex,
  fetchQuizPack,
  isQuizRemoteLanguage,
  isWorldQuestion,
  planPackSync,
  type QuizIndex,
  type QuizRemoteLanguage,
  type StoredQuizPack,
} from "@/utils/quizSync";

/** Packs change rarely (content waves); once a day is plenty. */
export const QUIZ_SYNC_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** After a failure, wait before retrying — the bootstrap re-runs on every status change. */
export const QUIZ_RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
let lastFailureAt = 0;

/** Test helper: forget the in-memory failure backoff. */
export function resetQuizSyncBackoff() {
  lastFailureAt = 0;
}

type QuizSyncStatus = "idle" | "syncing" | "success" | "error" | "skipped";

interface QuizPackState {
  clearPacks: () => void;
  etag: string | null;
  /** Language the stored packs / validators / version belong to. */
  lang: string | null;
  lastError: string | null;
  lastModified: string | null;
  lastSyncAt: number | null;
  packs: StoredQuizPack[];
  status: QuizSyncStatus;
  syncQuizPacks: (language: string) => Promise<void>;
  version: string | null;
}

const EMPTY = {
  etag: null,
  lang: null,
  lastModified: null,
  lastSyncAt: null,
  packs: [] as StoredQuizPack[],
  version: null,
};

export const useQuizPackStore = create<QuizPackState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      clearPacks: () => set({ ...EMPTY, lastError: null, status: "idle" }),
      lastError: null,
      status: "idle",
      syncQuizPacks: async (language) => {
        const state = get();
        const gate = syncGate(state, language);
        if (gate === "skip") {
          set({ lastError: null, status: "skipped" });
        }
        if (gate !== "run" || !isQuizRemoteLanguage(language)) {
          return;
        }

        set({ lastError: null, status: "syncing" });
        const sameLanguage = state.lang === language;
        const progress = { downloaded: 0 };
        try {
          // Validators only with packs in hand: a 304 means "keep yours".
          const outcome = await fetchQuizIndex(
            language,
            sameLanguage && state.version !== null
              ? { etag: state.etag, lastModified: state.lastModified }
              : null
          );
          if (outcome.notModified) {
            set({
              etag: outcome.validators.etag,
              lastModified: outcome.validators.lastModified,
              lastSyncAt: Date.now(),
              status: "success",
            });
            reportResult("unchanged", 0);
            return;
          }
          if (!outcome.index) {
            // 404: nothing published for this language (any more).
            set({
              ...EMPTY,
              lang: language,
              lastSyncAt: Date.now(),
              status: "success",
            });
            reportResult("not_published", 0);
            return;
          }
          const { index } = outcome;
          const packs = await downloadPacks(
            language,
            index,
            sameLanguage ? state.packs : [],
            progress,
            (partial) =>
              // Keep what arrived; drop the validators so the next sync
              // re-reads the index instead of getting a 304.
              set({
                etag: null,
                lang: language,
                lastModified: null,
                packs: partial,
                version: null,
              })
          );
          set({
            etag: outcome.validators.etag,
            lang: language,
            lastModified: outcome.validators.lastModified,
            lastSyncAt: Date.now(),
            packs,
            status: "success",
            version: index.version,
          });
          reportResult(
            progress.downloaded > 0 ? "updated" : "unchanged",
            progress.downloaded
          );
        } catch (error) {
          lastFailureAt = Date.now();
          set({ lastError: errorText(error), status: "error" });
          reportResult("error", progress.downloaded);
        }
      },
    }),
    safePersistOptions(() => fileStorage, {
      // A hand-edited / older-format file must not crash the quiz.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<QuizPackState>;
        const str = (v: unknown) => (typeof v === "string" ? v : null);
        return {
          ...current,
          etag: str(stored.etag),
          lang: str(stored.lang),
          lastModified: str(stored.lastModified),
          lastSyncAt:
            typeof stored.lastSyncAt === "number" ? stored.lastSyncAt : null,
          packs: sanitizePacks(stored.packs),
          version: str(stored.version),
        };
      },
      name: "quiz_packs",
      partialize: (state) => ({
        etag: state.etag,
        lang: state.lang,
        lastModified: state.lastModified,
        lastSyncAt: state.lastSyncAt,
        packs: state.packs,
        version: state.version,
      }),
      // ~400 KB per language — too big for AsyncStorage comfort (Android
      // CursorWindow): one file via fileStorage, like the article feed.
    })
  )
);
enablePersistRecovery(useQuizPackStore);

/** Whether a sync may run now: "wait" = silently later, "skip" = not now. */
function syncGate(
  state: QuizPackState,
  language: string
): "run" | "skip" | "wait" {
  // Before hydration lang / lastSyncAt / ETag are defaults and the sync
  // policy may not be the user's: the bootstrap retries after loading.
  if (!syncInputsHydrated() || state.status === "syncing") {
    return "wait";
  }
  const policy = useSettingsStore.getState().syncNetworkPolicy;
  if (
    // No server pool in this language: bundled questions only.
    !(
      isQuizRemoteLanguage(language) &&
      canSyncOnNetwork(useNetworkStore.getState(), policy)
    )
  ) {
    return "skip";
  }
  if (
    state.lang === language &&
    state.lastSyncAt !== null &&
    Date.now() - state.lastSyncAt < QUIZ_SYNC_MIN_INTERVAL_MS
  ) {
    return "skip";
  }
  if (Date.now() - lastFailureAt < QUIZ_RETRY_AFTER_FAILURE_MS) {
    return "wait";
  }
  return "run";
}

/**
 * Downloads new / changed packs one by one (slow in-flight Wi-Fi). On a
 * failure `onPartial` gets what is usable so far, then the error is thrown.
 */
async function downloadPacks(
  language: QuizRemoteLanguage,
  index: QuizIndex,
  stored: readonly StoredQuizPack[],
  progress: { downloaded: number },
  onPartial: (packs: StoredQuizPack[]) => void
): Promise<StoredQuizPack[]> {
  const plan = planPackSync(index, stored);
  const packs = [...plan.keep];
  try {
    for (const entry of plan.download) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose
      packs.push(await fetchQuizPack(language, entry));
      progress.downloaded += 1;
    }
  } catch (error) {
    onPartial(orderLike(index.packs, packs));
    throw error;
  }
  return orderLike(index.packs, packs);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "quiz sync failed";
}

function reportResult(
  result: "updated" | "unchanged" | "not_published" | "error",
  packs: number
) {
  // Coarse only: never question text or ids.
  captureAnalyticsEvent("quiz_pack_sync_result", { packs, result });
}

function orderLike(
  entries: readonly { id: string }[],
  packs: readonly StoredQuizPack[]
): StoredQuizPack[] {
  const order = new Map(entries.map((e, i) => [e.id, i]));
  return packs
    .filter((p) => order.has(p.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

function sanitizePacks(value: unknown): StoredQuizPack[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (p): p is StoredQuizPack =>
        typeof p?.id === "string" &&
        typeof p.sha256 === "string" &&
        Array.isArray(p.questions)
    )
    .map((p) => ({
      id: p.id,
      questions: p.questions.filter(isWorldQuestion),
      sha256: p.sha256,
    }));
}

function syncInputsHydrated() {
  return (
    useQuizPackStore.persist.hasHydrated() &&
    useSettingsStore.persist.hasHydrated()
  );
}

/** Downloaded questions for `language` (empty for another language). */
export function selectDownloadedQuestions(
  state: Pick<QuizPackState, "lang" | "packs">,
  language: string
): WorldQuestion[] {
  if (state.lang !== language) {
    return [];
  }
  return state.packs.flatMap((p) => p.questions);
}
