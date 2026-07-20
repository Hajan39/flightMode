import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type DiscoveryState = {
	seenGameIds: string[];
	markGameSeen: (id: string) => void;
};

export const useDiscoveryStore = create<DiscoveryState>()(
	persist(
		(set, get) => ({
			seenGameIds: [],
			markGameSeen: (id) => {
				if (get().seenGameIds.includes(id)) {
					return;
				}
				set((state) => ({ seenGameIds: [...state.seenGameIds, id] }));
			},
		}),
		{
			name: "discovery",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
