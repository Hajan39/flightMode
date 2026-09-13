import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { MAX_MATCH_PLAYERS } from "@/constants/Colors";

export const MAX_PLAYER_NAME_LENGTH = 12;

type SeatProfile = {
	/** Empty string = fall back to the localized "Player N". */
	name: string;
};

type PlayersState = {
	/** One profile per seat, index = seat number (0 = host / device owner). */
	seats: SeatProfile[];
	/** Player count chosen last time — pre-selects the setup screen. */
	lastCount: number;
	setSeatName: (index: number, name: string) => void;
	setLastCount: (count: number) => void;
};

const emptySeats = (): SeatProfile[] =>
	Array.from({ length: MAX_MATCH_PLAYERS }, () => ({ name: "" }));

/** Seat names + last player count so friends don't retype names between games. */
export const usePlayersStore = create<PlayersState>()(
	persist(
		(set) => ({
			seats: emptySeats(),
			lastCount: 2,
			setSeatName: (index, name) => {
				if (index < 0 || index >= MAX_MATCH_PLAYERS) return;
				const trimmed = name.replace(/\s+/g, " ").trimStart().slice(0, MAX_PLAYER_NAME_LENGTH);
				set((state) => {
					const seats = [...state.seats];
					while (seats.length < MAX_MATCH_PLAYERS) seats.push({ name: "" });
					seats[index] = { name: trimmed };
					return { seats };
				});
			},
			setLastCount: (count) =>
				set({ lastCount: Math.max(1, Math.min(MAX_MATCH_PLAYERS, count)) }),
		}),
		{
			name: "players",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
