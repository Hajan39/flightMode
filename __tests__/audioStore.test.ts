const mockPlayer = {
  addListener: jest.fn(),
  loop: false,
  pause: jest.fn(),
  play: jest.fn(),
  replace: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  volume: 1,
};

jest.mock("expo-audio", () => ({
  createAudioPlayer: () => mockPlayer,
  setAudioModeAsync: () => Promise.resolve(),
}));

type AudioModule = typeof import("@/store/useAudioStore");

function loadStore() {
  let mod: AudioModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/store/useAudioStore") as AudioModule;
  });
  if (!mod) {
    throw new Error("audio store failed to load");
  }
  return mod.useAudioStore;
}

describe("audio store sleep timer vs stopSound", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.UTC(2026, 9, 26, 22, 0));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("stopping a sound keeps a still-running sleep timer", () => {
    const store = loadStore();
    store.getState().playSound("rain", "relaxRain" as never, 1);
    store.getState().setSleepTimer(30);
    const endAt = store.getState().sleepTimerEndAt;
    expect(endAt).not.toBeNull();

    jest.advanceTimersByTime(10 * 60_000);
    store.getState().stopSound();
    expect(store.getState().activeSoundId).toBeNull();
    expect(store.getState().sleepTimerEndAt).toBe(endAt);
    expect(store.getState().sleepTimerPresetMinutes).toBe(30);

    // A new soundscape is still stopped by the original deadline.
    store.getState().playSound("ocean", "relaxOcean" as never, 2);
    jest.advanceTimersByTime(20 * 60_000);
    expect(store.getState().activeSoundId).toBeNull();
    expect(store.getState().sleepTimerEndAt).toBeNull();
  });

  test("stopping a sound drops an expired deadline", () => {
    const store = loadStore();
    store.setState({
      sleepTimerEndAt: Date.now() - 1,
      sleepTimerPresetMinutes: 15,
    });
    store.getState().stopSound();
    expect(store.getState().sleepTimerEndAt).toBeNull();
    expect(store.getState().sleepTimerPresetMinutes).toBeNull();
  });
});
