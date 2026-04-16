import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useOTAUpdate } from "@/hooks/useOTAUpdate";
import AchievementToast from "@/components/AchievementToast";

export {
	// Catch any errors thrown by the Layout component.
	ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
	initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	const [loaded, error] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
	});

	// Expo Router uses Error Boundaries to catch errors in the navigation tree.
	useEffect(() => {
		if (error) throw error;
	}, [error]);

	useEffect(() => {
		if (loaded) {
			SplashScreen.hideAsync();
		}
	}, [loaded]);

	if (!loaded) {
		return null;
	}

	return <RootLayoutNav />;
}

function RootLayoutNav() {
	const colorScheme = useColorScheme();

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<SafeAreaProvider>
				<RootStack />
				<AchievementToast />
			</SafeAreaProvider>
		</ThemeProvider>
	);
}

function RootStack() {
	const { t } = useTranslation();
	const router = useRouter();
	const segments = useSegments();
	const isFirstLaunch = useSettingsStore((s) => s.isFirstLaunch);

	useOTAUpdate(t as (key: string) => string);

	useEffect(() => {
		useAchievementStore.getState().updateStreak();
	}, []);

	useEffect(() => {
		if (isFirstLaunch && segments[0] !== "onboarding") {
			router.replace("/onboarding");
		}
	}, [isFirstLaunch, segments]);

	return (
		<Stack>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen
				name="onboarding"
				options={{ headerShown: false, gestureEnabled: false }}
			/>
			<Stack.Screen name="game/[id]" options={{ title: t("stackGame") }} />
			<Stack.Screen
				name="content/[id]"
				options={{ title: t("stackArticle") }}
			/>
			<Stack.Screen
				name="flight/edit"
				options={{ title: t("stackEditFlight"), presentation: "modal" }}
			/>
			<Stack.Screen
				name="settings"
				options={{ title: t("stackSettings"), presentation: "modal" }}
			/>
			<Stack.Screen
				name="profile"
				options={{ title: t("stackProfile"), presentation: "modal" }}
			/>
		</Stack>
	);
}
