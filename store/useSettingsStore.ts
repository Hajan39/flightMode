import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Language } from "@/i18n/translations";
import type { GameCategory } from "@/types/game";

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
  language: Language | null;
  /** Last time we asked Google Play for an in-app review (ms); null = never. */
  lastReviewPromptAt: number | null;
  markFirstSessionCompleted: () => void;
  markReviewPrompted: () => void;
  /** Game categories the user picked during onboarding; biases recommendations. Empty = no preference. */
  preferredCategories: GameCategory[];
  resetLanguage: () => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setHomeCurrency: (code: string) => void;
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
      language: null,
      lastReviewPromptAt: null as number | null,
      markFirstSessionCompleted: () => set({ hasCompletedFirstSession: true }),
      markReviewPrompted: () => set({ lastReviewPromptAt: Date.now() }),
      preferredCategories: [] as GameCategory[],
      resetLanguage: () => set({ language: null }),
      setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
      setHomeCurrency: (code) => set({ homeCurrency: code.toUpperCase() }),
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
    {
      name: "settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
