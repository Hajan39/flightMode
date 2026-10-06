import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
    {
      name: "discovery",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
