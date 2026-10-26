import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Types only: erased at build time, so they can't throw at import.
import type { Language, TranslationKey } from "@/i18n/translations";

/**
 * Custom root error boundary for expo-router. Replaces the default boundary so
 * that any render-time crash is logged (logcat + analytics) instead of failing
 * silently, and the user sees a recoverable screen rather than a blank crash.
 *
 * Intentionally self-contained: only React Native core primitives and hardcoded
 * colors — no theme store, no app hooks — because the error it renders may
 * originate from exactly those subsystems. Text is localized through plain,
 * non-hook reads (`safeText`) that fall back to English on any failure.
 *
 * The translations, settings store and error logger are required lazily at
 * render time inside try/catch: a module that throws while loading must not
 * take the boundary down with it (a static import would fail this module).
 */

type TranslationsModule = typeof import("@/i18n/translations");
type SettingsModule = typeof import("@/store/useSettingsStore");
type ErrorLoggingModule = typeof import("@/utils/errorLogging");

function loadTranslations(): TranslationsModule | null {
  try {
    return require("@/i18n/translations") as TranslationsModule;
  } catch {
    return null;
  }
}

function logError(error: unknown) {
  try {
    const { logFatalError } =
      require("@/utils/errorLogging") as ErrorLoggingModule;
    logFatalError(error, "render");
  } catch {
    // Logging must never break the fallback screen.
  }
}

const FALLBACK_TEXT = {
  errorBoundaryRetry: "Try again",
  errorBoundarySubtitle:
    "The app hit an unexpected error. You can try again — your saved data is safe.",
  errorBoundaryTitle: "Something went wrong",
} as const satisfies Partial<Record<TranslationKey, string>>;

type BoundaryTextKey = keyof typeof FALLBACK_TEXT;

/** Stored language > device language > en; never throws. */
function safeLanguage(): Language {
  try {
    const { useSettingsStore } =
      require("@/store/useSettingsStore") as SettingsModule;
    const stored = useSettingsStore.getState().language;
    if (stored) {
      return stored;
    }
  } catch {
    // Fall through to the device language.
  }
  try {
    return loadTranslations()?.getDeviceLanguage() ?? "en";
  } catch {
    return "en";
  }
}

/** Localized boundary text without hooks; English if anything fails. */
function safeText(language: Language, key: BoundaryTextKey): string {
  try {
    return loadTranslations()?.translate(language, key) || FALLBACK_TEXT[key];
  } catch {
    return FALLBACK_TEXT[key];
  }
}

/** Defensive: thrown values are not guaranteed to be Error instances at runtime. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown error";
  }
  const prefix = error.name ? `${error.name}: ` : "";
  return `${prefix}${error.message}`;
}
export default function RootErrorBoundary({
  error,
  retry,
}: ErrorBoundaryProps) {
  useEffect(() => {
    logError(error);
  }, [error]);
  const language = safeLanguage();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>✈️</Text>
        <Text style={styles.title}>
          {safeText(language, "errorBoundaryTitle")}
        </Text>
        <Text style={styles.subtitle}>
          {safeText(language, "errorBoundarySubtitle")}
        </Text>
        <Text numberOfLines={4} style={styles.detail}>
          {describeError(error)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Intentional fire-and-forget: nothing to do with retry()'s promise.
            retry();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {safeText(language, "errorBoundaryRetry")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#2f95dc",
    borderRadius: 24,
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  container: {
    backgroundColor: "#07111F",
    flex: 1,
  },
  content: {
    alignItems: "center",
    flexGrow: 1,
    gap: 12,
    justifyContent: "center",
    padding: 32,
  },
  detail: {
    color: "#5f7488",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  emoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  subtitle: {
    color: "#9fb3c8",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});
