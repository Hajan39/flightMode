import { Stack } from "expo-router";
import { useEffect } from "react";

import { useAudioStore } from "@/store/useAudioStore";

export const unstable_settings = {
  // A deep link straight into a kids game still has the kids home under it.
  initialRouteName: "index",
};

/**
 * Kids-mode area: no headers, no swipe-back to adult screens. The root
 * layout keeps the user in here while kids mode is on (utils/kidsMode.ts).
 */
export default function KidsLayout() {
  // No ambient music in kids mode: stop whatever the parent left playing.
  useEffect(() => {
    useAudioStore.getState().stopSound();
  }, []);

  return (
    <Stack screenOptions={{ gestureEnabled: false, headerShown: false }} />
  );
}
