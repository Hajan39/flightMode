import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SupporterState = {
	/** FlightMode Plus entitlement, cached so it works offline. */
	plus: boolean;
	tips: number;
	setPlus: (plus: boolean) => void;
	addTip: () => void;
};

export const useSupporterStore = create<SupporterState>()(
	persist(
		(set) => ({
			plus: false,
			tips: 0,
			setPlus: (plus) => set({ plus }),
			addTip: () => set((s) => ({ tips: s.tips + 1 })),
		}),
		{
			name: "supporter",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
