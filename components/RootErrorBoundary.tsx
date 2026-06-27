import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";

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
export default function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
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
				<Text style={styles.detail} numberOfLines={4}>
					{error?.name ? `${error.name}: ` : ""}
					{error?.message ?? "Unknown error"}
				</Text>
				<Pressable style={styles.button} onPress={() => void retry()}>
					<Text style={styles.buttonText}>Try again</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#07111F",
	},
	content: {
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 32,
		gap: 12,
	},
	emoji: {
		fontSize: 48,
		marginBottom: 4,
	},
	title: {
		color: "#ffffff",
		fontSize: 22,
		fontWeight: "700",
		textAlign: "center",
	},
	subtitle: {
		color: "#9fb3c8",
		fontSize: 15,
		lineHeight: 21,
		textAlign: "center",
	},
	detail: {
		color: "#5f7488",
		fontSize: 12,
		textAlign: "center",
		marginTop: 4,
	},
	button: {
		marginTop: 20,
		backgroundColor: "#2f95dc",
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 24,
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "700",
	},
});
