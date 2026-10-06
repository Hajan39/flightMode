import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export function useHaptic() {
  const tap = () => {
    if (isNative) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const success = () => {
    if (isNative) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const error = () => {
    if (isNative) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const heavy = () => {
    if (isNative) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  return { error, heavy, success, tap };
}
