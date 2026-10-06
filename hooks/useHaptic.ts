import {
  ImpactFeedbackStyle,
  impactAsync,
  NotificationFeedbackType,
  notificationAsync,
} from "expo-haptics";
import { Platform } from "react-native";

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export function useHaptic() {
  const tap = () => {
    if (isNative) {
      impactAsync(ImpactFeedbackStyle.Light);
    }
  };

  const success = () => {
    if (isNative) {
      notificationAsync(NotificationFeedbackType.Success);
    }
  };

  const error = () => {
    if (isNative) {
      notificationAsync(NotificationFeedbackType.Error);
    }
  };

  const heavy = () => {
    if (isNative) {
      impactAsync(ImpactFeedbackStyle.Heavy);
    }
  };

  return { error, heavy, success, tap };
}
