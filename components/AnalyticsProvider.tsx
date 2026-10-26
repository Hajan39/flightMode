import {
  PostHogPersistedProperty,
  PostHogProvider,
  usePostHog,
} from "posthog-react-native";
import { type PropsWithChildren, useEffect, useRef, useState } from "react";

import { canSyncOnNetwork, useNetworkStore } from "@/store/useNetworkStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import {
  captureAnalyticsEvent,
  disableAnalytics,
  getAnalyticsUploadMode,
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
        // Opted out until PostHogSink has read the user's (hydrated) choice:
        // nothing may be captured for a user who switched analytics off.
        defaultOptIn: false,
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
  const [hydrated, setHydrated] = useState(() =>
    useSettingsStore.persist.hasHydrated()
  );
  const analyticsEnabled = useSettingsStore((s) => s.analyticsEnabled);
  const syncNetworkPolicy = useSettingsStore((s) => s.syncNetworkPolicy);
  const isInternetReachable = useNetworkStore((s) => s.isInternetReachable);
  const networkType = useNetworkStore((s) => s.type);

  useEffect(
    () => runAfterHydration(useSettingsStore, () => setHydrated(true)),
    []
  );

  const mode = getAnalyticsUploadMode({
    enabled: analyticsEnabled,
    hydrated,
    networkAllowsUpload: canSyncOnNetwork(
      { isInternetReachable, type: networkType },
      syncNetworkPolicy
    ),
  });

  useEffect(() => {
    if (mode === "hold") {
      // Buffer in the bounded in-app queue (opt-out unknown yet, or the sync
      // policy forbids this network). PostHog's own queue may still hold
      // events captured while sending was allowed; its SDK flushes those on
      // its own timer / AppState change.
      setAnalyticsSink(null);
      return;
    }

    if (mode === "disabled") {
      disableAnalytics();
      // biome-ignore lint/complexity/noVoid: fire-and-forget; must never block UI
      void (async () => {
        try {
          await posthog.optOut();
          // optOut() only stops new captures — PostHog would still upload its
          // persisted queue. Drop it once storage is loaded.
          await posthog.ready();
          posthog.setPersistedProperty(PostHogPersistedProperty.Queue, null);
        } catch {
          // Analytics must never break offline-first app flows.
        }
      })();
      return;
    }

    // biome-ignore lint/complexity/noVoid: fire-and-forget; must never block UI
    void posthog.optIn().catch(() => undefined);
    setAnalyticsSink((eventName, properties) => {
      try {
        posthog.capture(eventName, properties);
      } catch {
        // Analytics must never break offline-first app flows.
      }
    });

    return () => setAnalyticsSink(null);
  }, [posthog, mode]);

  return <>{children}</>;
}

function DisabledAnalytics({ children }: PropsWithChildren) {
  useEffect(() => {
    disableAnalytics();
  }, []);

  return <>{children}</>;
}
