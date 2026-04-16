import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import * as Updates from "expo-updates";

/**
 * Checks for OTA updates on mount (production builds only).
 * If an update is available, downloads it and prompts the user to restart.
 */
export function useOTAUpdate(t: (key: string) => string) {
	useEffect(() => {
		if (__DEV__) return; // skip in development

		async function checkForUpdate() {
			try {
				const update = await Updates.checkForUpdateAsync();
				if (!update.isAvailable) return;

				const result = await Updates.fetchUpdateAsync();
				if (!result.isNew) return;

				if (Platform.OS === "web") {
					// Web: just reload
					Updates.reloadAsync();
					return;
				}

				Alert.alert(
					t("updateAvailableTitle"),
					t("updateAvailableMessage"),
					[
						{ text: t("updateLater"), style: "cancel" },
						{
							text: t("updateRestart"),
							onPress: () => Updates.reloadAsync(),
						},
					],
				);
			} catch {
				// Silently fail — user will get the update next launch
			}
		}

		checkForUpdate();
	}, []);
}
