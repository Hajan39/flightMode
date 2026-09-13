import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import type { Destination } from "@/data/destinations";
import { useTranslation } from "@/hooks/useTranslation";
import type { Flight } from "@/types/flight";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { getJetlagPlan } from "@/utils/timezone";

type Props = {
	flight: Flight;
	destination: Destination;
	/** Wall-clock "now" — passed in so the Home 30 s tick re-renders us. */
	nowMs: number;
};

function formatDeviceTime(ms: number) {
	const d = new Date(ms);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Small jet-lag hint under the flight card: hours shifted, direction, and a
 * concrete on-plane sleep suggestion. Renders nothing for shifts under 2 h.
 */
export default function JetlagCard({ flight, destination, nowMs }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const plan = getJetlagPlan({
		departureTime: flight.departureTime,
		duration: flight.duration,
		nowMs,
		destination,
	});

	useEffect(() => {
		if (plan.direction === "none") return;
		captureAnalyticsEvent("jetlag_card_shown", {
			shift_hours: plan.shiftHours,
			direction: plan.direction,
			severity: plan.severity,
		});
		// Fire once per flight, not on every 30 s tick.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [flight.id]);

	if (plan.direction === "none") return null;

	const hours = Math.abs(plan.shiftHours);
	const hoursLabel = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.card, borderColor: theme.border },
				Shadow.card,
			]}
			accessibilityRole="summary"
		>
			<View
				style={[styles.icon, { backgroundColor: theme.accentSoft }]}
				lightColor="transparent"
				darkColor="transparent"
			>
				<Ionicons
					name={plan.direction === "east" ? "sunny-outline" : "moon-outline"}
					size={20}
					color={theme.tint}
				/>
			</View>
			<View style={styles.body} lightColor="transparent" darkColor="transparent">
				<Text style={styles.title}>
					{t("jetlagTitle")} ·{" "}
					{t(plan.direction === "east" ? "jetlagAhead" : "jetlagBehind", {
						hours: hoursLabel,
					})}
				</Text>
				<Text style={[styles.advice, { color: theme.mutedText }]}>
					{t(plan.adviceKey)}
				</Text>
				{plan.sleepWindow ? (
					<Text style={[styles.window, { color: theme.tint }]}>
						{t("jetlagSleepWindow", {
							start: formatDeviceTime(plan.sleepWindow.startMs),
							end: formatDeviceTime(plan.sleepWindow.endMs),
						})}
					</Text>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.md,
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.lg,
		marginTop: Spacing.md,
	},
	icon: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	body: { flex: 1, gap: 4 },
	title: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
	advice: { fontSize: FontSize.sm, lineHeight: 18 },
	window: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 2 },
});
