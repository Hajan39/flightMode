import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/i18n/translations";
import type { GameCategory } from "@/types/game";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";

export type ThemeMode =
  | "system"
  | "light"
  | "dark"
  | "crazy"
  | "midnight"
  | "sunset";
export type SyncNetworkPolicy = "wifi_only" | "wifi_and_mobile" | "off";

interface SettingsState {
  analyticsEnabled: boolean;
  appOpenCount: number;
  completeOnboarding: () => void;
  hasCompletedFirstSession: boolean;
  /** ISO 4217 code the converter starts from; null = derive from the device locale. */
  homeCurrency: string | null;
  incrementAppOpenCount: () => number;
  isFirstLaunch: boolean;
  /**
   * Kids mode (ages 3–6, switched on by a parent): the app is locked to the
   * `/kids` picture-game area; no analytics, purchases, links or recorded
   * progress. See `utils/kidsMode.ts`.
   */
  kidsMode: boolean;
  language: Language | null;
  /** Last time we showed the rating dialog (ms); null = never. */
  lastReviewPromptAt: number | null;
  markFirstSessionCompleted: () => void;
  markReviewDone: () => void;
  markReviewPrompted: () => void;
  /** Game categories the user picked during onboarding; biases recommendations. Empty = no preference. */
  preferredCategories: GameCategory[];
  resetLanguage: () => void;
  /** Rated or chose "No thanks": never show the rating dialog again. */
  reviewDone: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setHomeCurrency: (code: string) => void;
  setKidsMode: (on: boolean) => void;
  setLanguage: (language: Language) => void;
  setSyncNetworkPolicy: (policy: SyncNetworkPolicy) => void;
  setThemeMode: (mode: ThemeMode) => void;
  syncNetworkPolicy: SyncNetworkPolicy;
  themeMode: ThemeMode;
  togglePreferredCategory: (category: GameCategory) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      analyticsEnabled: true,
      appOpenCount: 0,
      completeOnboarding: () => set({ isFirstLaunch: false }),
      hasCompletedFirstSession: false,
      homeCurrency: null as string | null,
      incrementAppOpenCount: () => {
        let nextCount = 1;
        set((state) => {
          nextCount = state.appOpenCount + 1;
          return { appOpenCount: nextCount };
        });
        return nextCount;
      },
      isFirstLaunch: true,
      kidsMode: false,
      language: null,
      lastReviewPromptAt: null as number | null,
      markFirstSessionCompleted: () => set({ hasCompletedFirstSession: true }),
      markReviewDone: () => set({ reviewDone: true }),
      markReviewPrompted: () => set({ lastReviewPromptAt: Date.now() }),
      preferredCategories: [] as GameCategory[],
      resetLanguage: () => set({ language: null }),
      reviewDone: false,
      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
      setHomeCurrency: (code) => set({ homeCurrency: code.toUpperCase() }),
      setKidsMode: (kidsMode) => set({ kidsMode }),
      setLanguage: (language) => set({ language }),
      setSyncNetworkPolicy: (syncNetworkPolicy) => set({ syncNetworkPolicy }),
      setThemeMode: (themeMode) => set({ themeMode }),
      syncNetworkPolicy: "wifi_only" as SyncNetworkPolicy,
      themeMode: "system" as ThemeMode,
      togglePreferredCategory: (category) =>
        set((state) => ({
          preferredCategories: state.preferredCategories.includes(category)
            ? state.preferredCategories.filter((c) => c !== category)
            : [...state.preferredCategories, category],
        })),
    }),
    safePersistOptions(() => AsyncStorage, { name: "settings" })
  )
);
enablePersistRecovery(useSettingsStore);

/** Non-React read of kids mode (stores, analytics, prompts). */
export function isKidsModeOn(): boolean {
  return useSettingsStore.getState().kidsMode === true;
}
