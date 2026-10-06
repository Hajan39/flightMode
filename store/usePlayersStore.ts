import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { MAX_MATCH_PLAYERS } from "@/constants/Colors";

export const MAX_PLAYER_NAME_LENGTH = 12;

interface SeatProfile {
  /** Empty string = fall back to the localized "Player N". */
  name: string;
}

interface PlayersState {
  /** Player count chosen last time — pre-selects the setup screen. */
  lastCount: number;
  /** One profile per seat, index = seat number (0 = host / device owner). */
  seats: SeatProfile[];
  setLastCount: (count: number) => void;
  setSeatName: (index: number, name: string) => void;
}

const emptySeats = (): SeatProfile[] =>
  Array.from({ length: MAX_MATCH_PLAYERS }, () => ({ name: "" }));

/** Seat names + last player count so friends don't retype names between games. */
export const usePlayersStore = create<PlayersState>()(
  persist(
    (set) => ({
      lastCount: 2,
      seats: emptySeats(),
      setLastCount: (count) =>
        set({ lastCount: Math.max(1, Math.min(MAX_MATCH_PLAYERS, count)) }),
      setSeatName: (index, name) => {
        if (index < 0 || index >= MAX_MATCH_PLAYERS) {
          return;
        }
        const trimmed = name
          .replace(/\s+/g, " ")
          .trimStart()
          .slice(0, MAX_PLAYER_NAME_LENGTH);
        set((state) => {
          const seats = [...state.seats];
          while (seats.length < MAX_MATCH_PLAYERS) {
            seats.push({ name: "" });
          }
          seats[index] = { name: trimmed };
          return { seats };
        });
      },
    }),
    {
      name: "players",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
