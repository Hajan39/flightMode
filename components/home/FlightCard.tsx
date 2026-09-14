import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import AnimatedPressable from "@/components/AnimatedPressable";
import JetlagCard from "@/components/JetlagCard";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import { getFlightProgress, getRemainingMinutes } from "@/store/useFlightStore";
import type { Flight } from "@/types/flight";
import { formatTimeInZone, getDayOffset } from "@/utils/timezone";

type Props = {
	flight: Flight | null;
	destination: Destination | undefined;
	/** Wall-clock "now" from Home's 30 s tick, so clocks refresh. */
	nowMs: number;
	onClear: () => void;
	onAddFlight: () => void;
	/** After arrival: show "Landed" instead of a progress readout. */
	landed?: boolean;
};

/** Active-flight card (progress, clocks, jet lag) or the "add your flight" prompt. */
export default function FlightCard({
	flight,
	destination,
	nowMs,
	onClear,
	onAddFlight,
	landed,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	if (!flight) {
		return (
			<AnimatedPressable
				style={[
					styles.addFlightCard,
					{ borderColor: theme.border, backgroundColor: theme.card },
				]}
				onPress={onAddFlight}
			>
				<Ionicons name="airplane-outline" size={30} color={theme.tint} />
				<Text style={styles.addFlightTitle}>{t("addYourFlight")}</Text>
				<Text style={[styles.addFlightSubtitle, { color: theme.mutedText }]}>
					{t("trackFlightRecommendation")}
				</Text>
			</AnimatedPressable>
		);
	}

	const progress = getFlightProgress(flight);
	const remaining = getRemainingMinutes(flight);
	const remainingRounded = Math.round(remaining);
	const remainingH = Math.floor(remainingRounded / 60);
	const remainingM = remainingRounded % 60;
	const arrivalMs = flight.departureTime + flight.duration * 60000;
	const arrivalDate = new Date(arrivalMs);
	const arrivalTime = `${String(arrivalDate.getHours()).padStart(2, "0")}:${String(
		arrivalDate.getMinutes(),
	).padStart(2, "0")}`;
	const destinationNow = destination ? formatTimeInZone(nowMs, destination) : null;
	const arrivalLocal = destination
		? (() => {
				const time = formatTimeInZone(arrivalMs, destination);
				const dayOffset = getDayOffset(arrivalMs, destination, nowMs);
				return dayOffset > 0 ? `${time} ${t("nextDaySuffix")}` : time;
			})()
		: null;

	return (
		<View style={[styles.flightShell, { backgroundColor: `${theme.border}30` }]}>
			<View
				style={[styles.flightCard, { backgroundColor: theme.accentSoft }, Shadow.card]}
			>
				<View style={styles.flightHeader}>
					<Ionicons name="airplane" size={20} color={theme.tint} />
					<Text style={styles.flightTitle}>
						{flight.flightNumber ?? t("yourFlight")}
					</Text>
					<Pressable
						onPress={onClear}
						hitSlop={10}
						accessibilityLabel={t("a11yClearFlight")}
					>
						<Ionicons
							name="close-circle-outline"
							size={20}
							color={theme.mutedText}
						/>
					</Pressable>
				</View>

				<View style={[styles.progressBar, { backgroundColor: theme.progressTrack }]}>
					<AnimatedProgressFill progress={progress} color={theme.tint} />
				</View>
				<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
					{landed
						? t("flightLanded")
						: `${Math.round(progress * 100)}% — ${t("remainingTime", {
								hours: remainingH,
								minutes: remainingM,
							})}`}
				</Text>
				{!arrivalLocal && (
					<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
						{t("arrivalTime", { time: arrivalTime })}
					</Text>
				)}
				{destination && destinationNow && arrivalLocal && (
					<>
						<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
							{t("destinationLocalTime", {
								city: destination.city,
								time: destinationNow,
							})}
						</Text>
						<Text style={[styles.progressLabel, { color: theme.mutedText }]}>
							{t("arrivalTimeLocal", { time: arrivalLocal })}
						</Text>
					</>
				)}

				{landed ? null : (
				<View style={styles.recommendation}>
					<Ionicons name="bulb-outline" size={16} color={theme.warning} />
					<Text style={[styles.recommendationText, { color: theme.mutedText }]}>
						{remaining > 120
							? t("recommendationLong")
							: remaining > 30
								? t("recommendationMid")
								: t("recommendationShort")}
					</Text>
				</View>
				)}
			</View>
			{destination ? (
				<JetlagCard flight={flight} destination={destination} nowMs={nowMs} />
			) : null}
		</View>
	);
}

function AnimatedProgressFill({
	progress,
	color,
}: {
	progress: number;
	color: string;
}) {
	const width = useSharedValue(0);

	useEffect(() => {
		width.value = withTiming(Math.round(progress * 100), {
			duration: 800,
			easing: Easing.out(Easing.cubic),
		});
	}, [progress, width]);

	const fillStyle = useAnimatedStyle(() => ({
		width: `${width.value}%`,
		height: "100%",
		backgroundColor: color,
		borderRadius: 4,
	}));

	return <Animated.View style={fillStyle} />;
}

const styles = StyleSheet.create({
	// Double-bezel: outer shell + inner core
	flightShell: {
		borderRadius: Radius.xl + 4,
		padding: 4,
		marginBottom: Spacing["2xl"],
	},
	flightCard: { padding: Spacing.xl, borderRadius: Radius.xl },
	flightHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 16,
		backgroundColor: "transparent",
	},
	flightTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
	progressBar: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
	progressLabel: { fontSize: 13 },
	recommendation: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 12,
		backgroundColor: "transparent",
	},
	recommendationText: { fontSize: 13, flex: 1 },
	addFlightCard: {
		alignItems: "center",
		padding: Spacing["2xl"],
		borderRadius: Radius.xl,
		borderWidth: 2,
		borderStyle: "dashed",
		marginBottom: 6,
	},
	addFlightTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
	addFlightSubtitle: { fontSize: 13, marginTop: 4, textAlign: "center" },
});
