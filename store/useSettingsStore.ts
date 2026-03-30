import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@/i18n/translations';

type SettingsState = {
  isFirstLaunch: boolean;
  language: Language | null;
  completeOnboarding: () => void;
  setLanguage: (language: Language) => void;
  resetLanguage: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isFirstLaunch: true,
      language: null,
      completeOnboarding: () => set({ isFirstLaunch: false }),
      setLanguage: (language) => set({ language }),
      resetLanguage: () => set({ language: null }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
