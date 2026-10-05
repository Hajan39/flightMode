import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";
import { create } from "zustand";

import type { TranslationKey } from "@/i18n/translations";

const globalPlayer =
	Platform.OS !== "web" ? createAudioPlayer(null) : (null as any);
let sleepTimerRef: ReturnType<typeof setTimeout> | null = null;
let backgroundModeSet = false;

/**
 * Keep soundscapes playing with the screen off (the main in-flight use: sleep
 * with rain / white noise + sleep timer). On Android the lock-screen media
 * notification is what keeps the media-playback foreground service alive —
 * without it playback stops after ~3 minutes in the background.
 */
function startBackgroundPlayback(title: string) {
	if (!backgroundModeSet) {
		backgroundModeSet = true;
		void setAudioModeAsync({
			shouldPlayInBackground: true,
			playsInSilentMode: true,
			interruptionMode: "doNotMix",
		}).catch(() => {
			backgroundModeSet = false;
		});
	}
	try {
		globalPlayer.setActiveForLockScreen(true, { title, artist: "FlightMode" });
	} catch {
		// Older native build without lock-screen support — foreground playback still works.
	}
}

function stopBackgroundPlayback() {
	try {
		globalPlayer?.setActiveForLockScreen(false);
	} catch {
		// ignore
	}
}

type AudioState = {
	activeSoundId: string | null;
	activeLabelKey: TranslationKey | null;
	volume: number;
	sleepTimerEndAt: number | null;
	sleepTimerPresetMinutes: number | null;
	playSound: (id: string, labelKey: TranslationKey, source: number, title?: string) => void;
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
	playSound: (id, labelKey, source, title) => {
		if (!globalPlayer) return;
		if (get().activeSoundId === id) {
			globalPlayer.pause();
			stopBackgroundPlayback();
			set({ activeSoundId: null, activeLabelKey: null });
			return;
		}

		try {
			globalPlayer.replace(source);
			globalPlayer.loop = true;
			globalPlayer.volume = get().volume;
			globalPlayer.play();
			startBackgroundPlayback(title ?? "FlightMode");
			set({ activeSoundId: id, activeLabelKey: labelKey });
		} catch {
			set({ activeSoundId: null, activeLabelKey: null });
		}
	},
	stopSound: () => {
		globalPlayer?.pause();
		stopBackgroundPlayback();
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
			stopBackgroundPlayback();
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
