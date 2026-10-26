import {
  __setNativeForTests,
  getSignInBackoffMs,
  initPlayGames,
  isPlayGamesSignedIn,
  setUnlockedPlayIdsSource,
  unlockPlayGamesAchievement,
} from "@/utils/playGames";

function fakeNative(signInResults: (boolean | Error)[]) {
  const results = [...signInResults];
  return {
    signInSilently: jest.fn(() => {
      const next = results.shift() ?? false;
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    }),
    unlockAchievement: jest.fn(() => Promise.resolve()),
  };
}

describe("Play Games sign-in retry + resend", () => {
  let now = 1_000_000;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    now = 1_000_000;
    nowSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
    setUnlockedPlayIdsSource(() => ["CgkI_a", "CgkI_b"]);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    setUnlockedPlayIdsSource(null);
    __setNativeForTests(null);
  });

  test("backoff grows and is capped", () => {
    expect(getSignInBackoffMs(0)).toBe(0);
    expect(getSignInBackoffMs(1)).toBe(60_000);
    expect(getSignInBackoffMs(2)).toBe(120_000);
    expect(getSignInBackoffMs(20)).toBe(15 * 60_000);
  });

  test("without a native module everything is a silent no-op", async () => {
    __setNativeForTests(null);
    await expect(initPlayGames()).resolves.toBeUndefined();
    await expect(unlockPlayGamesAchievement("CgkI_x")).resolves.toBeUndefined();
    expect(isPlayGamesSignedIn()).toBe(false);
  });

  test("a failed launch sign-in is retried on a later unlock after backoff, then all unlocks are re-sent", async () => {
    const native = fakeNative([new Error("offline"), true]);
    __setNativeForTests(native);

    await initPlayGames(); // launch: fails
    expect(isPlayGamesSignedIn()).toBe(false);

    // Within the backoff window: no spam, unlock is dropped for now.
    now += 10_000;
    await unlockPlayGamesAchievement("CgkI_b");
    expect(native.signInSilently).toHaveBeenCalledTimes(1);
    expect(native.unlockAchievement).not.toHaveBeenCalled();

    // After the backoff the next unlock retries, signs in and re-sends.
    now += 60_000;
    await unlockPlayGamesAchievement("CgkI_b");
    expect(native.signInSilently).toHaveBeenCalledTimes(2);
    expect(isPlayGamesSignedIn()).toBe(true);
    const sent = native.unlockAchievement.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    expect(sent).toEqual(expect.arrayContaining(["CgkI_a", "CgkI_b"]));
  });

  test("network-reachable retry ignores the backoff", async () => {
    const native = fakeNative([false, true]);
    __setNativeForTests(native);
    await initPlayGames();
    await initPlayGames({ ignoreBackoff: true });
    expect(native.signInSilently).toHaveBeenCalledTimes(2);
    expect(native.unlockAchievement).toHaveBeenCalledTimes(2);
  });

  test("concurrent attempts share one sign-in; signed-in is final", async () => {
    const native = fakeNative([true]);
    __setNativeForTests(native);
    await Promise.all([initPlayGames(), initPlayGames(), initPlayGames()]);
    await initPlayGames();
    expect(native.signInSilently).toHaveBeenCalledTimes(1);
  });

  test("a throwing unlock or id source never escapes", async () => {
    const native = fakeNative([true]);
    native.unlockAchievement.mockImplementation(() =>
      Promise.reject(new Error("boom"))
    );
    __setNativeForTests(native);
    setUnlockedPlayIdsSource(() => {
      throw new Error("bad store");
    });
    await expect(initPlayGames()).resolves.toBeUndefined();
    await expect(unlockPlayGamesAchievement("CgkI_x")).resolves.toBeUndefined();
  });

  test("resend dedupes ids, skips empty ones and survives a failing unlock", async () => {
    const native = fakeNative([true]);
    native.unlockAchievement.mockImplementationOnce(() =>
      Promise.reject(new Error("first fails"))
    );
    __setNativeForTests(native);
    setUnlockedPlayIdsSource(() => [
      "CgkI_a",
      "",
      "CgkI_b",
      "CgkI_a",
      "CgkI_c",
    ]);
    await initPlayGames();
    const sent = native.unlockAchievement.mock.calls.map(
      (c: unknown[]) => c[0]
    );
    // The first call threw; the rest were still sent, each id exactly once.
    expect(sent).toEqual(["CgkI_a", "CgkI_b", "CgkI_c"]);
  });
});
