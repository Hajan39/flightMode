import { PostHogProvider, usePostHog } from "posthog-react-native";
import { type PropsWithChildren, useEffect, useRef } from "react";

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
	const incrementAppOpenCount = useSettingsStore(
		(state) => state.incrementAppOpenCount,
	);
	const language = useSettingsStore((state) => state.language);
	const themeMode = useSettingsStore((state) => state.themeMode);
	const hasTrackedAppOpenRef = useRef(false);

	useEffect(() => {
		if (hasTrackedAppOpenRef.current) return;
		hasTrackedAppOpenRef.current = true;

		const appOpenCount = incrementAppOpenCount();

		captureAnalyticsEvent("app_open", {
			is_first_launch: isFirstLaunch,
			app_open_count: appOpenCount,
			is_returning_user: appOpenCount > 1,
			language: language ?? "system",
			theme_mode: themeMode,
		});

		if (appOpenCount === 2) {
			captureAnalyticsEvent("second_session_started", {
				language: language ?? "system",
			});
		}
	}, [incrementAppOpenCount, isFirstLaunch, language, themeMode]);

	return null;
}

function PostHogSink({ children }: PropsWithChildren) {
	const posthog = usePostHog();
	const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);

	useEffect(() => {
		if (!analyticsEnabled) {
			disableAnalytics();
			return;
		}

		setAnalyticsSink((eventName, properties) => {
			try {
				posthog.capture(eventName, properties);
			} catch {
				// Analytics must never break offline-first app flows.
			}
		});

		return () => setAnalyticsSink(null);
	}, [posthog, analyticsEnabled]);

	return <>{children}</>;
}

function DisabledAnalytics({ children }: PropsWithChildren) {
	useEffect(() => {
		disableAnalytics();
	}, []);

	return <>{children}</>;
}
