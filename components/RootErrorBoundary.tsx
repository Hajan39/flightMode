import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { logFatalError } from "@/utils/errorLogging";

/**
 * Custom root error boundary for expo-router. Replaces the default boundary so
 * that any render-time crash is logged (logcat + analytics) instead of failing
 * silently, and the user sees a recoverable screen rather than a blank crash.
 *
 * Intentionally self-contained: only React Native core primitives and hardcoded
 * colors — no theme store, no translations, no app hooks — because the error it
 * renders may originate from exactly those subsystems.
 */
export default function RootErrorBoundary({
  error,
  retry,
}: ErrorBoundaryProps) {
  useEffect(() => {
    logFatalError(error, "render");
  }, [error]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.emoji}>✈️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an unexpected error. You can try again — your saved data
          is safe.
        </Text>
        <Text numberOfLines={4} style={styles.detail}>
          {error?.name ? `${error.name}: ` : ""}
          {error?.message ?? "Unknown error"}
        </Text>
        <Pressable onPress={() => void retry()} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
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
