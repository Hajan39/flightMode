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

function offsetDate(baseDate: string, delta: number): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDate);
	if (!match) return baseDate;
	const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
	d.setDate(d.getDate() + delta);
	return toDateInputValue(d.getTime());
}

function dayOffsetFromToday(dateStr: string): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
	if (!match) return -1;
	const target = new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
	);
	return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function localTzLabel(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "";
	}
}

type StepperProps = {
	value: string;
	onDecrement: () => void;
	onIncrement: () => void;
	tint: string;
	textColor: string;
	bgColor: string;
	borderColor: string;
};

function Stepper({
	value,
	onDecrement,
	onIncrement,
	tint,
	textColor,
	bgColor,
	borderColor,
}: StepperProps) {
	return (
		<View style={[styles.stepper, { backgroundColor: bgColor, borderColor }]}>
			<Pressable onPress={onDecrement} hitSlop={8} style={styles.stepBtn}>
				<Text style={[styles.stepBtnText, { color: tint }]}>−</Text>
			</Pressable>
			<Text style={[styles.stepValue, { color: textColor }]}>{value}</Text>
			<Pressable onPress={onIncrement} hitSlop={8} style={styles.stepBtn}>
				<Text style={[styles.stepBtnText, { color: tint }]}>+</Text>
			</Pressable>
		</View>
	);
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
		existingFlight ? String(Math.floor(existingFlight.duration / 60)) : "2",
	);
	const [minutes, setMinutes] = useState(
		existingFlight ? String(existingFlight.duration % 60) : "00",
	);
	const [departureDate, setDepartureDate] = useState(
		toDateInputValue(initialDepartureTime),
	);
	const [departureClock, setDepartureClock] = useState(
		toTimeInputValue(initialDepartureTime),
	);
	const [flightNumber, setFlightNumber] = useState(
		existingFlight?.flightNumber ?? "",
	);

	// Parse current clock for steppers
	const clockMatch = /^(\d{2}):(\d{2})$/.exec(departureClock);
	const clockHour = clockMatch ? Number(clockMatch[1]) : 0;
	const clockMinute = clockMatch ? Number(clockMatch[2]) : 0;

	function adjustHour(delta: number) {
		const next = (clockHour + delta + 24) % 24;
		setDepartureClock(`${pad2(next)}:${pad2(clockMinute)}`);
	}

	function adjustMinute(delta: number) {
		const next = (clockMinute + delta + 60) % 60;
		setDepartureClock(`${pad2(clockHour)}:${pad2(next)}`);
	}

	// Duration steppers
	const durationHours = parseInt(hours, 10) || 0;
	const durationMins = parseInt(minutes, 10) || 0;

	function adjustDurationHour(delta: number) {
		const next = Math.max(0, Math.min(24, durationHours + delta));
		setHours(String(next));
	}

	function adjustDurationMinute(delta: number) {
		let next = durationMins + delta;
		if (next < 0) next = 55;
		if (next >= 60) next = 0;
		setMinutes(pad2(next));
	}

	const dayOffset = dayOffsetFromToday(departureDate);
	const dateChips = [
		{ labelKey: "flightDateToday" as const, offset: 0 },
		{ labelKey: "flightDateTomorrow" as const, offset: 1 },
		{ labelKey: "flightDateIn2Days" as const, offset: 2 },
	];

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
			flightNumber: flightNumber.trim() || undefined,
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

	const tz = localTzLabel();

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

					{/* Flight Number (optional) */}
					<View style={styles.fieldGroup}>
						<Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
							{t("flightNumberLabel")}
						</Text>
						<TextInput
							style={[
								styles.textInput,
								{
									borderColor: theme.border,
									backgroundColor: theme.inputBackground,
									color: theme.text,
								},
							]}
							value={flightNumber}
							onChangeText={setFlightNumber}
							placeholder={t("flightNumberPlaceholder")}
							placeholderTextColor={theme.mutedText}
							autoCapitalize="characters"
							autoCorrect={false}
							maxLength={8}
						/>
					</View>

					{/* Departure Date — quick chips + day stepper */}
					<View style={styles.fieldGroup}>
						<Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
							{t("flightDepartureDate")}
						</Text>
						<View style={styles.chipRow}>
							{dateChips.map((chip) => {
								const active = dayOffset === chip.offset;
								return (
									<Pressable
										key={chip.offset}
										onPress={() =>
											setDepartureDate(
												offsetDate(toDateInputValue(Date.now()), chip.offset),
											)
										}
										style={[
											styles.chip,
											{
												backgroundColor: active ? theme.tint : theme.card,
												borderColor: active ? theme.tint : theme.border,
											},
										]}
									>
										<Text
											style={[
												styles.chipText,
												{ color: active ? "#fff" : theme.text },
											]}
										>
											{t(chip.labelKey)}
										</Text>
									</Pressable>
								);
							})}
						</View>
						<View style={styles.dayStepperRow}>
							<Pressable
								onPress={() => setDepartureDate(offsetDate(departureDate, -1))}
								hitSlop={8}
								style={[
									styles.dayStepBtn,
									{ borderColor: theme.border, backgroundColor: theme.card },
								]}
							>
								<Text style={[styles.dayArrow, { color: theme.tint }]}>‹</Text>
							</Pressable>
							<Text style={[styles.dayLabel, { color: theme.text }]}>
								{departureDate}
							</Text>
							<Pressable
								onPress={() => setDepartureDate(offsetDate(departureDate, +1))}
								hitSlop={8}
								style={[
									styles.dayStepBtn,
									{ borderColor: theme.border, backgroundColor: theme.card },
								]}
							>
								<Text style={[styles.dayArrow, { color: theme.tint }]}>›</Text>
							</Pressable>
						</View>
					</View>

					{/* Departure Time stepper */}
					<View style={styles.fieldGroup}>
						<View style={styles.labelRow}>
							<Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
								{t("flightDepartureTime")}
							</Text>
							{tz ? (
								<Text style={[styles.tzLabel, { color: theme.mutedText }]}>
									{tz}
								</Text>
							) : null}
						</View>
						<View style={styles.timeRow}>
							<Stepper
								value={pad2(clockHour)}
								onDecrement={() => adjustHour(-1)}
								onIncrement={() => adjustHour(+1)}
								tint={theme.tint}
								textColor={theme.text}
								bgColor={theme.card}
								borderColor={theme.border}
							/>
							<Text style={[styles.colon, { color: theme.text }]}>:</Text>
							<Stepper
								value={pad2(clockMinute)}
								onDecrement={() => adjustMinute(-5)}
								onIncrement={() => adjustMinute(+5)}
								tint={theme.tint}
								textColor={theme.text}
								bgColor={theme.card}
								borderColor={theme.border}
							/>
						</View>
					</View>

					{/* Flight Duration steppers */}
					<View style={styles.fieldGroup}>
						<Text style={[styles.fieldLabel, { color: theme.mutedText }]}>
							{t("flightDuration")}
						</Text>
						<View style={styles.timeRow}>
							<View style={styles.durationGroup}>
								<Stepper
									value={String(durationHours)}
									onDecrement={() => adjustDurationHour(-1)}
									onIncrement={() => adjustDurationHour(+1)}
									tint={theme.tint}
									textColor={theme.text}
									bgColor={theme.card}
									borderColor={theme.border}
								/>
								<Text style={[styles.durationUnit, { color: theme.mutedText }]}>
									{t("hours")}
								</Text>
							</View>
							<Text style={[styles.colon, { color: theme.text }]}>:</Text>
							<View style={styles.durationGroup}>
								<Stepper
									value={pad2(durationMins)}
									onDecrement={() => adjustDurationMinute(-5)}
									onIncrement={() => adjustDurationMinute(+5)}
									tint={theme.tint}
									textColor={theme.text}
									bgColor={theme.card}
									borderColor={theme.border}
								/>
								<Text style={[styles.durationUnit, { color: theme.mutedText }]}>
									{t("minutes")}
								</Text>
							</View>
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
	keyboardContainer: { flex: 1 },
	scrollContent: { flexGrow: 1 },
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
		minHeight: "100%",
		gap: 20,
	},
	icon: { marginBottom: 0 },
	title: { fontSize: 24, fontWeight: "700", marginTop: -4 },
	subtitle: { fontSize: 14, marginTop: -8 },
	// Field groups
	fieldGroup: { width: "100%", gap: 8 },
	fieldLabel: {
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	labelRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	tzLabel: { fontSize: 11 },
	// Flight number input
	textInput: {
		width: "100%",
		height: 44,
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		fontSize: 16,
		fontWeight: "600",
	},
	// Date chips
	chipRow: { flexDirection: "row", gap: 8 },
	chip: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
	},
	chipText: { fontSize: 13, fontWeight: "700" },
	// Day stepper
	dayStepperRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	dayStepBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	dayArrow: { fontSize: 22, lineHeight: 26, fontWeight: "700" },
	dayLabel: {
		fontSize: 15,
		fontWeight: "600",
		minWidth: 110,
		textAlign: "center",
	},
	// Time / duration stepper row
	timeRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	colon: { fontSize: 28, fontWeight: "700", marginHorizontal: 4 },
	// Stepper component
	stepper: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 12,
		overflow: "hidden",
	},
	stepBtn: {
		width: 40,
		height: 52,
		alignItems: "center",
		justifyContent: "center",
	},
	stepBtnText: { fontSize: 24, fontWeight: "700" },
	stepValue: {
		fontSize: 22,
		fontWeight: "800",
		minWidth: 44,
		textAlign: "center",
	},
	// Duration
	durationGroup: { alignItems: "center", gap: 4 },
	durationUnit: {
		fontSize: 11,
		fontWeight: "600",
		textTransform: "uppercase",
	},
	// CTA button
	button: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 30,
		gap: 8,
		marginTop: 4,
	},
	buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
