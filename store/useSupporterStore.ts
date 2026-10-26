import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistOptions } from "@/utils/persistStorage";

interface SupporterState {
  addTip: () => void;
  /** FlightMode Plus entitlement, cached so it works offline. */
  plus: boolean;
  setPlus: (plus: boolean) => void;
  tips: number;
}

export const useSupporterStore = create<SupporterState>()(
  persist(
    (set) => ({
      addTip: () => set((s) => ({ tips: s.tips + 1 })),
      plus: false,
      setPlus: (plus) => set({ plus }),
      tips: 0,
    }),
    safePersistOptions(() => AsyncStorage, {
      name: "supporter",
    })
  )
);
