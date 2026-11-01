import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";

/**
 * Quiz preferences + "already asked" history for world questions. A store of
 * its own (not useGameStore): game progress has a migration history and
 * whole-map semantics; this is small, quiz-only, and safe to lose.
 */
export type QuizMode = "mix" | "world" | "aviation";
export const QUIZ_MODES: readonly QuizMode[] = ["mix", "world", "aviation"];

/**
 * Max remembered ids per language. Oldest drop first, so with a pool larger
 * than this the least recently asked questions come back first. The pick
 * logic also starts a new cycle once every question was asked.
 */
export const ASKED_HISTORY_CAP = 2000;

interface QuizState {
  /** World-question ids already asked, oldest first, per language. */
  askedWorld: Record<string, string[]>;
  mode: QuizMode;
  setAskedWorld: (language: string, ids: readonly string[]) => void;
  setMode: (mode: QuizMode) => void;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set) => ({
      askedWorld: {},
      mode: "mix",
      setAskedWorld: (language, ids) =>
        set((state) => ({
          askedWorld: {
            ...state.askedWorld,
            [language]: ids.slice(-ASKED_HISTORY_CAP),
          },
        })),
      setMode: (mode) => set({ mode }),
    }),
    safePersistOptions(() => AsyncStorage, {
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<QuizState>;
        return {
          ...current,
          askedWorld: sanitizeAsked(stored.askedWorld),
          mode: QUIZ_MODES.includes(stored.mode as QuizMode)
            ? (stored.mode as QuizMode)
            : current.mode,
        };
      },
      name: "quiz",
      partialize: (state) => ({
        askedWorld: state.askedWorld,
        mode: state.mode,
      }),
    })
  )
);
enablePersistRecovery(useQuizStore);

function sanitizeAsked(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string[]> = {};
  for (const [lang, ids] of Object.entries(value)) {
    if (Array.isArray(ids)) {
      out[lang] = ids
        .filter((id): id is string => typeof id === "string")
        .slice(-ASKED_HISTORY_CAP);
    }
  }
  return out;
}
