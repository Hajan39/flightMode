import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { AppState, Platform } from "react-native";
import { create } from "zustand";

import type { TranslationKey } from "@/i18n/translations";
import { shouldStopForSleepTimer } from "@/utils/sleepTimer";

// 1 s status updates are plenty for the sleep-timer deadline check below.
const globalPlayer =
  Platform.OS === "web"
    ? null
    : createAudioPlayer(null, { updateInterval: 1000 });
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
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void setAudioModeAsync({
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => {
      backgroundModeSet = false;
    });
  }
  try {
    globalPlayer?.setActiveForLockScreen(true, { artist: "FlightMode", title });
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

interface AudioState {
  activeLabelKey: TranslationKey | null;
  activeSoundId: string | null;
  /** Stops playback if the sleep-timer wall-clock deadline has passed. */
  checkSleepTimer: (now?: number) => void;
  playSound: (
    id: string,
    labelKey: TranslationKey,
    source: number,
    title?: string
  ) => void;
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
  checkSleepTimer: (now = Date.now()) => {
    if (!shouldStopForSleepTimer(get().sleepTimerEndAt, now)) {
      return;
    }
    if (sleepTimerRef) {
      clearTimeout(sleepTimerRef);
      sleepTimerRef = null;
    }
    globalPlayer?.pause();
    stopBackgroundPlayback();
    set({
      activeLabelKey: null,
      activeSoundId: null,
      sleepTimerEndAt: null,
      sleepTimerPresetMinutes: null,
    });
  },
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

    // The wall-clock deadline is the source of truth. Android pauses JS
    // timers in the background (screen off), so this setTimeout only covers
    // the foreground; the playback-status listener and the AppState check
    // below enforce the deadline while the screen is off / on resume.
    const endAt = Date.now() + minutes * 60_000;
    sleepTimerRef = setTimeout(() => {
      sleepTimerRef = null;
      get().checkSleepTimer(Math.max(Date.now(), endAt));
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
    // The timer was cancelled above, so drop its deadline too — a stale one
    // would otherwise stop the next soundscape the moment it starts.
    set({
      activeLabelKey: null,
      activeSoundId: null,
      sleepTimerEndAt: null,
      sleepTimerPresetMinutes: null,
    });
  },
  volume: 0.6,
}));

// expo-audio emits `playbackStatusUpdate` from a native coroutine every
// `updateInterval` while playing; unlike JS timers it keeps firing in the
// background media session, so this enforces the deadline with the screen off.
// (expo-audio has no native "stop at" / duration API to schedule the stop.)
try {
  globalPlayer?.addListener("playbackStatusUpdate", () =>
    useAudioStore.getState().checkSleepTimer()
  );
} catch {
  // Listener support missing — the AppState check below still applies.
}

AppState.addEventListener("change", (status) => {
  if (status === "active") {
    useAudioStore.getState().checkSleepTimer();
  }
});
