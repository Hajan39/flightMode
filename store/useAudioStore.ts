import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { create } from "zustand";

import type { TranslationKey } from "@/i18n/translations";

const globalPlayer =
	Platform.OS !== "web" ? createAudioPlayer(null) : (null as any);
let sleepTimerRef: ReturnType<typeof setTimeout> | null = null;

type AudioState = {
	activeSoundId: string | null;
	activeLabelKey: TranslationKey | null;
	volume: number;
	sleepTimerEndAt: number | null;
	sleepTimerPresetMinutes: number | null;
	playSound: (id: string, labelKey: TranslationKey, source: number) => void;
	stopSound: () => void;
	setVolume: (volume: number) => void;
	setSleepTimer: (minutes: number | null) => void;
};

export const useAudioStore = create<AudioState>((set, get) => ({
	activeSoundId: null,
	activeLabelKey: null,
	volume: 0.65,
	sleepTimerEndAt: null,
	sleepTimerPresetMinutes: null,
	playSound: (id, labelKey, source) => {
		if (!globalPlayer) return;
		if (get().activeSoundId === id) {
			globalPlayer.pause();
			set({ activeSoundId: null, activeLabelKey: null });
			return;
		}

		try {
			globalPlayer.replace(source);
			globalPlayer.loop = true;
			globalPlayer.volume = get().volume;
			globalPlayer.play();
			set({ activeSoundId: id, activeLabelKey: labelKey });
		} catch {
			set({ activeSoundId: null, activeLabelKey: null });
		}
	},
	stopSound: () => {
		globalPlayer?.pause();
		if (sleepTimerRef) {
			clearTimeout(sleepTimerRef);
			sleepTimerRef = null;
		}
		set({ activeSoundId: null, activeLabelKey: null });
	},
	setVolume: (volume) => {
		const normalized = Math.max(0, Math.min(1, volume));
		if (globalPlayer) globalPlayer.volume = normalized;
		set({ volume: normalized });
	},
	setSleepTimer: (minutes) => {
		if (sleepTimerRef) {
			clearTimeout(sleepTimerRef);
			sleepTimerRef = null;
		}

		if (!minutes || minutes <= 0) {
			set({ sleepTimerEndAt: null, sleepTimerPresetMinutes: null });
			return;
		}

		const endAt = Date.now() + minutes * 60_000;
		sleepTimerRef = setTimeout(() => {
			globalPlayer?.pause();
			sleepTimerRef = null;
			set({
				activeSoundId: null,
				activeLabelKey: null,
				sleepTimerEndAt: null,
				sleepTimerPresetMinutes: null,
			});
		}, minutes * 60_000);

		set({ sleepTimerEndAt: endAt, sleepTimerPresetMinutes: minutes });
	},
}));
