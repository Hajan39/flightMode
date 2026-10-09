import {
  lockAsync,
  OrientationLock,
  unlockAsync,
} from "expo-screen-orientation";
import { useEffect } from "react";
import { Platform, useWindowDimensions } from "react-native";

/**
 * Android's large-screen threshold (smallest width in dp). Below it the device
 * is a phone, where the games' layouts are designed for portrait.
 */
export const LARGE_SCREEN_MIN_DP = 600;

export function isLargeScreen(width: number, height: number): boolean {
  return Math.min(width, height) >= LARGE_SCREEN_MIN_DP;
}

/**
 * Portrait on phones, free rotation and resizing on tablets, foldables and
 * desktop windows. The manifest no longer pins `screenOrientation` (Play flags
 * that for large screens, and Android 16 ignores it there anyway); the phone
 * lock is applied at runtime instead, which is Google's recommended pattern.
 * Re-evaluated on every size change, so unfolding a foldable unlocks rotation.
 */
export default function OrientationPolicy() {
  const { width, height } = useWindowDimensions();
  const large = isLargeScreen(width, height);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const apply = large
      ? unlockAsync()
      : lockAsync(OrientationLock.PORTRAIT_UP);
    apply.catch(() => {
      // Orientation is a comfort feature; never let it break startup.
    });
  }, [large]);

  return null;
}
