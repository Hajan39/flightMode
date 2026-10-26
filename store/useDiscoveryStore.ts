import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  enablePersistRecovery,
  safePersistOptions,
} from "@/utils/persistStorage";

interface DiscoveryState {
  markGameSeen: (id: string) => void;
  seenGameIds: string[];
}

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set, get) => ({
      markGameSeen: (id) => {
        if (get().seenGameIds.includes(id)) {
          return;
        }
        set((state) => ({ seenGameIds: [...state.seenGameIds, id] }));
      },
      seenGameIds: [],
    }),
    safePersistOptions(() => AsyncStorage, {
      name: "discovery",
    })
  )
);
enablePersistRecovery(useDiscoveryStore);
