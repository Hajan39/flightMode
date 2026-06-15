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
import { scheduleFlightReadyReminder } from "@/utils/notifications";

function pad2(value: number) {
	return String(value).padStart(2, "0");
}

function toDateInputValue(timestamp: number) {
	const date = new Date(timestamp);
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeInputValue(timestamp: number) {
	const date = new Date(timestamp);
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalDateTime(dateInput: string, timeInput: string) {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeInput.trim());
	if (!dateMatch || !timeMatch) return null;

	const year = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const day = Number(dateMatch[3]);
	const hours = Number(timeMatch[1]);
	const minutes = Number(timeMatch[2]);

	if (hours > 23 || minutes > 59) return null;

	const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
	if (
		parsed.getFullYear() !== year ||
		parsed.getMonth() !== month - 1 ||
		parsed.getDate() !== day ||
		parsed.getHours() !== hours ||
		parsed.getMinutes() !== minutes
	) {
		return null;
	}

	return parsed.getTime();
}

export default function FlightEditScreen() {
	const router = useRouter();
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const setFlight = useFlightStore((s) => s.setFlight);
	const existingFlight = useFlightStore((s) => s.flight);
	const incrementFlights = useAchievementStore((s) => s.incrementFlights);
	const isEditingFlight = Boolean(existingFlight);
	const initialDepartureTime = existingFlight?.departureTime ?? Date.now();

	const [hours, setHours] = useState(
		existingFlight ? String(Math.floor(existingFlight.duration / 60)) : "",
	);
	const [minutes, setMinutes] = useState(
		existingFlight ? String(existingFlight.duration % 60) : "",
	);
	const [departureDate, setDepartureDate] = useState(
		toDateInputValue(initialDepartureTime),
	);
	const [departureClock, setDepartureClock] = useState(
		toTimeInputValue(initialDepartureTime),
	);

	const handleSave = async () => {
		const h = parseInt(hours, 10) || 0;
		const m = parseInt(minutes, 10) || 0;
		const totalMinutes = h * 60 + m;
		const departureTime = parseLocalDateTime(departureDate, departureClock);

		if (totalMinutes <= 0) {
			Alert.alert(t("invalidDurationTitle"), t("invalidDurationMessage"));
			return;
		}

		if (!departureTime) {
			Alert.alert(t("invalidDepartureTitle"), t("invalidDepartureMessage"));
			return;
		}

		setFlight({
			id: existingFlight?.id ?? Date.now().toString(),
			departureTime,
			duration: totalMinutes,
		});
		if (!existingFlight) incrementFlights();
		captureAnalyticsEvent(isEditingFlight ? "flight_edited" : "flight_added", {
			duration_minutes: totalMinutes,
			departure_time: departureTime,
		});
		captureAnalyticsEvent("flight_setup_completed", {
			duration_minutes: totalMinutes,
			mode: isEditingFlight ? "edit" : "create",
			departure_time: departureTime,
			is_departure_in_future: departureTime > Date.now(),
		});

		const reminderResult = await scheduleFlightReadyReminder(departureTime);
		if (reminderResult.scheduled) {
			captureAnalyticsEvent("reminder_scheduled", {
				reminder_kind: "flight_ready",
				scheduled_for: reminderResult.scheduledFor,
				departure_time: departureTime,
			});
		} else {
			captureAnalyticsEvent("reminder_permission_denied", {
				reminder_kind: "flight_ready",
				departure_time: departureTime,
			});
		}

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

					<View style={styles.departureRow}>
						<View style={styles.departureGroup}>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("flightDepartureDate")}
							</Text>
							<TextInput
								style={[
									styles.departureInput,
									{
										borderColor: theme.border,
										backgroundColor: theme.inputBackground,
										color: theme.text,
									},
								]}
								value={departureDate}
								onChangeText={setDepartureDate}
								placeholder={t("flightDepartureDatePlaceholder")}
								placeholderTextColor={theme.mutedText}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
						<View style={styles.departureGroup}>
							<Text style={[styles.label, { color: theme.mutedText }]}>
								{t("flightDepartureTime")}
							</Text>
							<TextInput
								style={[
									styles.departureInput,
									{
										borderColor: theme.border,
										backgroundColor: theme.inputBackground,
										color: theme.text,
									},
								]}
								value={departureClock}
								onChangeText={setDepartureClock}
								placeholder={t("flightDepartureTimePlaceholder")}
								placeholderTextColor={theme.mutedText}
								autoCapitalize="none"
								autoCorrect={false}
							/>
						</View>
					</View>

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
	departureRow: {
		width: "100%",
		flexDirection: "row",
		gap: 12,
		marginBottom: 18,
	},
	departureGroup: {
		flex: 1,
		alignItems: "center",
	},
	row: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
	inputGroup: { alignItems: "center" },
	label: { fontSize: 12, marginBottom: 4 },
	departureInput: {
		width: "100%",
		height: 48,
		borderWidth: 1,
		borderRadius: 10,
		textAlign: "center",
		fontSize: 16,
		fontWeight: "600",
		paddingHorizontal: 10,
	},
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
