import { useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { isNetworkUsable, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { initPlayGames, shouldAutoSignInPlayGames } from "@/utils/playGames";

/**
 * Kicks off a silent Google Play Games sign-in on launch so the first
 * achievement push isn't delayed by an on-demand sign-in, and retries it when
 * the internet becomes reachable (a launch while offline would otherwise leave
 * Play signed out for the session). `initPlayGames()` backs off after failures
 * and re-sends local unlocks once signed in.
 *
 * On a first launch the sign-in is deferred until onboarding is complete and
 * the app is on a normal screen (`shouldAutoSignInPlayGames`), so Play's
 * sign-in prompt never covers onboarding. Returning users sign in as soon as
 * the settings store has hydrated.
 *
 * `initPlayGames()` is a guarded no-op when no native PGS module is linked
 * (Expo Go, iOS, web, current release build), so mounting this is always safe.
 */
export default function PlayGamesBootstrap() {
  const segments = useSegments();
  const isFirstLaunch = useSettingsStore((s) => s.isFirstLaunch);
  const [settingsHydrated, setSettingsHydrated] = useState(() =>
    useSettingsStore.persist.hasHydrated()
  );

  useEffect(() => {
    const unsubscribe = useSettingsStore.persist.onFinishHydration(() =>
      setSettingsHydrated(true)
    );
    setSettingsHydrated(useSettingsStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  const allowed = shouldAutoSignInPlayGames({
    isFirstLaunch,
    routeSegment: segments[0],
    settingsHydrated,
  });

  useEffect(() => {
    if (!allowed) {
      return;
    }
    // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
    void initPlayGames();

    let wasUsable = isNetworkUsable(useNetworkStore.getState());
    return useNetworkStore.subscribe((state) => {
      const usable = isNetworkUsable(state);
      if (usable && !wasUsable) {
        // biome-ignore lint/complexity/noVoid: intentional fire-and-forget
        void initPlayGames({ ignoreBackoff: true });
      }
      wasUsable = usable;
    });
  }, [allowed]);

  return null;
}
