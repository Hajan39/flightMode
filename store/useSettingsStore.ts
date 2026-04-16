import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language } from "@/i18n/translations";

export type ThemeMode = "system" | "light" | "dark" | "crazy";

type SettingsState = {
	isFirstLaunch: boolean;
	language: Language | null;
	themeMode: ThemeMode;
	completeOnboarding: () => void;
	setLanguage: (language: Language) => void;
	resetLanguage: () => void;
	setThemeMode: (mode: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			isFirstLaunch: true,
			language: null,
			themeMode: "system" as ThemeMode,
			completeOnboarding: () => set({ isFirstLaunch: false }),
			setLanguage: (language) => set({ language }),
			resetLanguage: () => set({ language: null }),
			setThemeMode: (themeMode) => set({ themeMode }),
		}),
		{
			name: "settings",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
