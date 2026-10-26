import { PostHogProvider, usePostHog } from "posthog-react-native";
import { type PropsWithChildren, useEffect, useRef } from "react";

import { useSettingsStore } from "@/store/useSettingsStore";
import {
  captureAnalyticsEvent,
  disableAnalytics,
  setAnalyticsSink,
} from "@/utils/analytics";
import { runAfterHydration } from "@/utils/hydration";

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
        captureAppLifecycleEvents: false,
        disableGeoip: true,
        disableRemoteConfig: true,
        disableSurveys: true,
        enableSessionReplay: false,
        host: postHogHost,
        personProfiles: "never",
      }}
    >
      <PostHogSink>{children}</PostHogSink>
    </PostHogProvider>
  );
}

export function AnalyticsBootstrap() {
  const hasTrackedAppOpenRef = useRef(false);

  useEffect(
    () =>
      // Count the open only after persisted settings loaded: an earlier write
      // is overwritten by hydration (appOpenCount would stay stuck at 1, so
      // the rating dialog and second_session_started never happen).
      runAfterHydration(useSettingsStore, () => {
        // biome-ignore lint/suspicious/noUnnecessaryConditions: the ref flips to true below; this guards StrictMode/effect re-runs
        if (hasTrackedAppOpenRef.current) {
          return;
        }
        hasTrackedAppOpenRef.current = true;

        const settings = useSettingsStore.getState();
        const appOpenCount = settings.incrementAppOpenCount();

        captureAnalyticsEvent("app_open", {
          app_open_count: appOpenCount,
          is_first_launch: settings.isFirstLaunch,
          is_returning_user: appOpenCount > 1,
          language: settings.language ?? "system",
          theme_mode: settings.themeMode,
        });

        if (appOpenCount === 2) {
          captureAnalyticsEvent("second_session_started", {
            language: settings.language ?? "system",
          });
        }
      }),
    []
  );

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
