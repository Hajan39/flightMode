import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Platform } from "react-native";
import { create } from "zustand";

import type { TranslationKey } from "@/i18n/translations";

const globalPlayer =
  Platform.OS === "web" ? (null as any) : createAudioPlayer(null);
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
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => {
      backgroundModeSet = false;
    });
  }
  try {
    globalPlayer.setActiveForLockScreen(true, { artist: "FlightMode", title });
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
  playSound: (
    id: string,
    labelKey: TranslationKey,
    source: number,
    title?: string
  ) => void;
  stopSound: () => void;
  setVolume: (volume: number) => void;
  setSleepTimer: (minutes: number | null) => void;
};

export const useAudioStore = create<AudioState>((set, get) => ({
  activeLabelKey: null,
  activeSoundId: null,
  playSound: (id, labelKey, source, title) => {
    if (!globalPlayer) {
      return;
    }
    if (get().activeSoundId === id) {
      globalPlayer.pause();
      stopBackgroundPlayback();
      set({ activeLabelKey: null, activeSoundId: null });
      return;
    }

    try {
      globalPlayer.replace(source);
      globalPlayer.loop = true;
      globalPlayer.volume = get().volume;
      globalPlayer.play();
      startBackgroundPlayback(title ?? "FlightMode");
      set({ activeLabelKey: labelKey, activeSoundId: id });
    } catch {
      set({ activeLabelKey: null, activeSoundId: null });
    }
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
        activeLabelKey: null,
        activeSoundId: null,
        sleepTimerEndAt: null,
        sleepTimerPresetMinutes: null,
      });
    }, minutes * 60_000);

    set({ sleepTimerEndAt: endAt, sleepTimerPresetMinutes: minutes });
  },
  setVolume: (volume) => {
    const normalized = Math.max(0, Math.min(1, volume));
    if (globalPlayer) {
      globalPlayer.volume = normalized;
    }
    set({ volume: normalized });
  },
  sleepTimerEndAt: null,
  sleepTimerPresetMinutes: null,
  stopSound: () => {
    globalPlayer?.pause();
    stopBackgroundPlayback();
    if (sleepTimerRef) {
      clearTimeout(sleepTimerRef);
      sleepTimerRef = null;
    }
    set({ activeLabelKey: null, activeSoundId: null });
  },
  volume: 0.65,
}));
