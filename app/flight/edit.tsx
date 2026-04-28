import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useTranslation } from "@/hooks/useTranslation";
import { useAchievementStore } from "@/store/useAchievementStore";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";

export default function FlightEditScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const setFlight = useFlightStore((s) => s.setFlight);
	const existingFlight = useFlightStore((s) => s.flight);
	const incrementFlights = useAchievementStore((s) => s.incrementFlights);
	const isEditingFlight = Boolean(existingFlight);

	const [hours, setHours] = useState(
		existingFlight ? String(Math.floor(existingFlight.duration / 60)) : "",
	);
	const [minutes, setMinutes] = useState(
		existingFlight ? String(existingFlight.duration % 60) : "",
	);

	const handleSave = () => {
		const h = parseInt(hours, 10) || 0;
		const m = parseInt(minutes, 10) || 0;
		const totalMinutes = h * 60 + m;

		if (totalMinutes <= 0) {
			Alert.alert(t("invalidDurationTitle"), t("invalidDurationMessage"));
			return;
		}

		// Editing an active flight should keep its timeline; only duration changes.
		setFlight({
			id: existingFlight?.id ?? Date.now().toString(),
			departureTime: existingFlight?.departureTime ?? Date.now(),
			duration: totalMinutes,
		});
		if (!existingFlight) incrementFlights();
		captureAnalyticsEvent(isEditingFlight ? "flight_edited" : "flight_added", {
			duration_minutes: totalMinutes,
		});

		router.back();
	};

	return (
		<KeyboardAvoidingView
			style={styles.keyboardContainer}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 24}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.container}>
					<Ionicons
						name="airplane"
						size={48}
						color={theme.tint}
						style={styles.icon}
					/>
					<Text style={styles.title}>{t("setYourFlight")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("enterFlightDuration")}
					</Text>

					<View style={styles.row}>
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("hours")}
							</Text>
							<TextInput
								style={[
									styles.input,
									{
										borderColor: theme.border,
										backgroundColor: theme.inputBackground,
										color: theme.text,
									},
								]}
								value={hours}
								onChangeText={setHours}
								keyboardType="number-pad"
								placeholder="0"
								placeholderTextColor={theme.mutedText}
								maxLength={2}
								returnKeyType="done"
							/>
						</View>
						<Text style={styles.colon}>:</Text>
						<View style={styles.inputGroup}>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("minutes")}
							</Text>
							<TextInput
								style={[
									styles.input,
									{
										borderColor: theme.border,
										backgroundColor: theme.inputBackground,
										color: theme.text,
									},
								]}
								value={minutes}
								onChangeText={setMinutes}
								keyboardType="number-pad"
								placeholder="00"
								placeholderTextColor={theme.mutedText}
								maxLength={2}
								returnKeyType="done"
							/>
						</View>
					</View>

					<Pressable
						style={[styles.button, { backgroundColor: theme.tint }]}
						onPress={handleSave}
					>
						<Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
						<Text style={styles.buttonText}>{t("startFlight")}</Text>
					</Pressable>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	keyboardContainer: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
	},
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
		minHeight: "100%",
	},
	icon: { marginBottom: 16 },
	title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
	subtitle: { fontSize: 14, marginBottom: 32 },
	row: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
	inputGroup: { alignItems: "center" },
	label: { fontSize: 12, marginBottom: 4 },
	input: {
		width: 80,
		height: 60,
		borderWidth: 2,
		borderRadius: 12,
		textAlign: "center",
		fontSize: 28,
		fontWeight: "700",
	},
	colon: { fontSize: 32, fontWeight: "700", marginHorizontal: 12 },
	button: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#2f95dc",
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 30,
		gap: 8,
	},
	buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
