import {
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
} from "expo-updates";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

/**
 * Checks for OTA updates on mount (production builds only).
 * If an update is available, downloads it and prompts the user to restart.
 */
export function useOTAUpdate(t: (key: string) => string) {
  useEffect(() => {
    // biome-ignore lint/correctness/noUndeclaredVariables: __DEV__ is a React Native global
    if (__DEV__) {
      return; // skip in development
    }

    async function checkForUpdate() {
      try {
        const update = await checkForUpdateAsync();
        if (!update.isAvailable) {
          return;
        }

        const result = await fetchUpdateAsync();
        if (!result.isNew) {
          return;
        }

        if (Platform.OS === "web") {
          // Web: just reload
          reloadAsync();
          return;
        }

        Alert.alert(t("updateAvailableTitle"), t("updateAvailableMessage"), [
          { style: "cancel", text: t("updateLater") },
          {
            onPress: () => reloadAsync(),
            text: t("updateRestart"),
          },
        ]);
      } catch {
        // Silently fail — user will get the update next launch
      }
    }

    checkForUpdate();
  }, [t]);
}
