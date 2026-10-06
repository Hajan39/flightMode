import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { create } from "zustand";

import type { TranslationKey } from "@/i18n/translations";

const globalPlayer = Platform.OS === "web" ? null : createAudioPlayer(null);
let sleepTimerRef: ReturnType<typeof setTimeout> | null = null;

interface AudioState {
  activeLabelKey: TranslationKey | null;
  activeSoundId: string | null;
  playSound: (id: string, labelKey: TranslationKey, source: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  setVolume: (volume: number) => void;
  sleepTimerEndAt: number | null;
  sleepTimerPresetMinutes: number | null;
  stopSound: () => void;
  volume: number;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  activeLabelKey: null,
  activeSoundId: null,
  playSound: (id, labelKey, source) => {
    if (!globalPlayer) {
      return;
    }
    if (get().activeSoundId === id) {
      globalPlayer.pause();
      set({ activeLabelKey: null, activeSoundId: null });
      return;
    }

    try {
      globalPlayer.replace(source);
      globalPlayer.loop = true;
      globalPlayer.volume = get().volume;
      globalPlayer.play();
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
    if (sleepTimerRef) {
      clearTimeout(sleepTimerRef);
      sleepTimerRef = null;
    }
    set({ activeLabelKey: null, activeSoundId: null });
  },
  volume: 0.65,
}));
