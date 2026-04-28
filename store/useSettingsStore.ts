import type { Language } from "@/i18n/translations";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark" | "crazy";
export type SyncNetworkPolicy = "wifi_only" | "wifi_and_mobile" | "off";

type SettingsState = {
	isFirstLaunch: boolean;
	language: Language | null;
	themeMode: ThemeMode;
	syncNetworkPolicy: SyncNetworkPolicy;
	completeOnboarding: () => void;
	setLanguage: (language: Language) => void;
	resetLanguage: () => void;
	setThemeMode: (mode: ThemeMode) => void;
	setSyncNetworkPolicy: (policy: SyncNetworkPolicy) => void;
};

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			isFirstLaunch: true,
			language: null,
			themeMode: "system" as ThemeMode,
			syncNetworkPolicy: "wifi_only" as SyncNetworkPolicy,
			completeOnboarding: () => set({ isFirstLaunch: false }),
			setLanguage: (language) => set({ language }),
			resetLanguage: () => set({ language: null }),
			setThemeMode: (themeMode) => set({ themeMode }),
			setSyncNetworkPolicy: (syncNetworkPolicy) =>
				set({ syncNetworkPolicy }),
		}),
		{
			name: "settings",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
