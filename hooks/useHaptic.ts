import {
  ImpactFeedbackStyle,
  impactAsync,
  NotificationFeedbackType,
  notificationAsync,
} from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export interface Haptic {
  error: () => void;
  heavy: () => void;
  success: () => void;
  tap: () => void;
}

/**
 * One module-level object: every caller gets the same, referentially stable
 * functions, so `haptic` / `haptic.tap` in effect deps never re-run an effect
 * (fresh functions per render used to re-buzz result overlays and rebuild
 * game intervals on every render).
 */
const haptic: Haptic = Object.freeze({
  error: () => {
    if (isNative) {
      notificationAsync(NotificationFeedbackType.Error);
    }
  },
  heavy: () => {
    if (isNative) {
      impactAsync(ImpactFeedbackStyle.Heavy);
    }
  },
  success: () => {
    if (isNative) {
      notificationAsync(NotificationFeedbackType.Success);
    }
  },
  tap: () => {
    if (isNative) {
      impactAsync(ImpactFeedbackStyle.Light);
    }
  },
});

export function useHaptic(): Haptic {
  return haptic;
}
