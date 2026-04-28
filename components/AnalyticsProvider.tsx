import { PostHogProvider, usePostHog } from "posthog-react-native";
import { useEffect, type PropsWithChildren } from "react";

import { useSettingsStore } from "@/store/useSettingsStore";
import {
    captureAnalyticsEvent,
    disableAnalytics,
    setAnalyticsSink,
} from "@/utils/analytics";

const postHogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const postHogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST;
const analyticsDisabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === "false";

export function AnalyticsProvider({ children }: PropsWithChildren) {
	if (!postHogKey || analyticsDisabled) {
		return <DisabledAnalytics>{children}</DisabledAnalytics>;
	}

	return (
		<PostHogProvider
			apiKey={postHogKey}
			autocapture={false}
			options={{
				host: postHogHost,
				captureAppLifecycleEvents: false,
				disableGeoip: true,
				disableRemoteConfig: true,
				disableSurveys: true,
				enableSessionReplay: false,
				personProfiles: "never",
			}}
		>
			<PostHogSink>{children}</PostHogSink>
		</PostHogProvider>
	);
}

export function AnalyticsBootstrap() {
	const isFirstLaunch = useSettingsStore((state) => state.isFirstLaunch);
	const language = useSettingsStore((state) => state.language);
	const themeMode = useSettingsStore((state) => state.themeMode);

	useEffect(() => {
		captureAnalyticsEvent("app_open", {
			is_first_launch: isFirstLaunch,
			language: language ?? "system",
			theme_mode: themeMode,
		});
	}, []);

	return null;
}

function PostHogSink({ children }: PropsWithChildren) {
	const posthog = usePostHog();

	useEffect(() => {
		setAnalyticsSink((eventName, properties) => {
			try {
				posthog.capture(eventName, properties);
			} catch {
				// Analytics must never break offline-first app flows.
			}
		});

		return () => setAnalyticsSink(null);
	}, [posthog]);

	return <>{children}</>;
}

function DisabledAnalytics({ children }: PropsWithChildren) {
	useEffect(() => {
		disableAnalytics();
	}, []);

	return <>{children}</>;
}
