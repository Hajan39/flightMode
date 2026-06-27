import { useFonts } from "expo-font";
import "expo-insights";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AchievementToast from "@/components/AchievementToast";
import {
	AnalyticsBootstrap,
	AnalyticsProvider,
} from "@/components/AnalyticsProvider";
import ContentSyncBootstrap from "@/components/ContentSyncBootstrap";
import ImageSyncBootstrap from "@/components/ImageSyncBootstrap";
import NetworkStatusBootstrap from "@/components/NetworkStatusBootstrap";
import NotificationBootstrap from "@/components/NotificationBootstrap";
import RootErrorBoundary from "@/components/RootErrorBoundary";
import SafeBoundary from "@/components/SafeBoundary";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useOTAUpdate } from "@/hooks/useOTAUpdate";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { installGlobalErrorHandler } from "@/utils/errorLogging";

// Record uncaught JS errors that a React error boundary cannot catch
// (async callbacks, native module init). Installed at module load — before
// any component renders — so the earliest startup errors are captured.
installGlobalErrorHandler();

// Custom error boundary (logs to logcat + analytics, shows a recoverable
// screen) replacing expo-router's default silent boundary.
export const ErrorBoundary = RootErrorBoundary;

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
	// Each non-visual bootstrap is isolated: if one throws while mounting it is
	// logged and skipped (renders null) instead of crashing app startup. The
	// navigation tree (RootStack) is intentionally left to the root
	// ErrorBoundary so a navigation crash shows the recoverable retry screen
	// rather than a blank screen.
	return (
		<AnalyticsProvider>
			<SafeAreaProvider>
				<SafeBoundary name="AnalyticsBootstrap">
					<AnalyticsBootstrap />
				</SafeBoundary>
				<SafeBoundary name="NetworkStatusBootstrap">
					<NetworkStatusBootstrap />
				</SafeBoundary>
				<SafeBoundary name="NotificationBootstrap">
					<NotificationBootstrap />
				</SafeBoundary>
				<SafeBoundary name="ContentSyncBootstrap">
					<ContentSyncBootstrap />
				</SafeBoundary>
				<SafeBoundary name="ImageSyncBootstrap">
					<ImageSyncBootstrap />
				</SafeBoundary>
				<RootStack />
				<SafeBoundary name="AchievementToast">
					<AchievementToast />
				</SafeBoundary>
			</SafeAreaProvider>
		</AnalyticsProvider>
	);
}

function RootStack() {
	const { t } = useTranslation();
	const router = useRouter();
	const segments = useSegments();
	const isFirstLaunch = useSettingsStore((s) => s.isFirstLaunch);
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme] ?? Colors.light;

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
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: theme.card },
				headerTintColor: theme.text,
				headerShadowVisible: false,
			}}
		>
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
