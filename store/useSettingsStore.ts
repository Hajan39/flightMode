import type { Language } from "@/i18n/translations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark" | "crazy";
export type SyncNetworkPolicy = "wifi_only" | "wifi_and_mobile" | "off";

type SettingsState = {
	isFirstLaunch: boolean;
	appOpenCount: number;
	hasCompletedFirstSession: boolean;
	language: Language | null;
	themeMode: ThemeMode;
	syncNetworkPolicy: SyncNetworkPolicy;
	analyticsEnabled: boolean;
	completeOnboarding: () => void;
	incrementAppOpenCount: () => number;
	markFirstSessionCompleted: () => void;
	setLanguage: (language: Language) => void;
	resetLanguage: () => void;
	setThemeMode: (mode: ThemeMode) => void;
	setSyncNetworkPolicy: (policy: SyncNetworkPolicy) => void;
	setAnalyticsEnabled: (enabled: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			isFirstLaunch: true,
			appOpenCount: 0,
			hasCompletedFirstSession: false,
			language: null,
			themeMode: "system" as ThemeMode,
			syncNetworkPolicy: "wifi_only" as SyncNetworkPolicy,
			analyticsEnabled: true,
			completeOnboarding: () => set({ isFirstLaunch: false }),
			incrementAppOpenCount: () => {
				let nextCount = 1;
				set((state) => {
					nextCount = state.appOpenCount + 1;
					return { appOpenCount: nextCount };
				});
				return nextCount;
			},
			markFirstSessionCompleted: () => set({ hasCompletedFirstSession: true }),
			setLanguage: (language) => set({ language }),
			resetLanguage: () => set({ language: null }),
			setThemeMode: (themeMode) => set({ themeMode }),
			setSyncNetworkPolicy: (syncNetworkPolicy) => set({ syncNetworkPolicy }),
			setAnalyticsEnabled: (analyticsEnabled) => set({ analyticsEnabled }),
		}),
		{
			name: "settings",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
