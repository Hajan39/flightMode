import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useTranslation } from "@/hooks/useTranslation";
import { useFlightStore } from "@/store/useFlightStore";
import { captureAnalyticsEvent } from "@/utils/analytics";
import { getPassportSummary } from "@/utils/passport";

const STORE_URL =
	"https://play.google.com/store/apps/details?id=com.hajan39.flightmode";

/** Flight Passport: a stamp per departed flight + lifetime totals, shareable. */
export default function PassportSection() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t, language } = useTranslation();
	const log = useFlightStore((s) => s.log);
	const summary = useMemo(() => getPassportSummary(log, Date.now()), [log]);
	const hours = Math.round(summary.minutesInAir / 6) / 10;

	const handleShare = () => {
		captureAnalyticsEvent("passport_shared", {
			flights: summary.flights,
			cities: summary.cities,
		});
		void Share.share({
			message: t("passportShareMessage", {
				flights: summary.flights,
				hours,
				cities: summary.cities,
				url: STORE_URL,
			}),
		});
	};

	return (
		<View lightColor="transparent" darkColor="transparent" crazyColor="transparent">
			<Text style={[styles.title, { color: theme.text }]}>{t("passportTitle")}</Text>
			<Text style={[styles.hint, { color: theme.mutedText }]}>
				{summary.flights > 0 ? t("passportHint") : t("passportEmpty")}
			</Text>

			<View
				style={[styles.totals, { backgroundColor: theme.card, borderColor: theme.border }]}
			>
				<Total value={summary.flights} label={t("passportFlights")} theme={theme} />
				<Total value={hours} label={t("passportHours")} theme={theme} />
				<Total value={summary.cities} label={t("passportCities")} theme={theme} />
				<Total value={summary.countries} label={t("passportCountries")} theme={theme} />
			</View>

			{summary.stamps.length > 0 ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.stamps}
				>
					{summary.stamps.map((stamp) => (
						<View
							key={stamp.id}
							style={[styles.stamp, { borderColor: theme.tint }]}
							lightColor="transparent"
							darkColor="transparent"
							crazyColor="transparent"
						>
							<Text style={styles.stampEmoji}>{stamp.emoji}</Text>
							<Text style={[styles.stampCity, { color: theme.text }]} numberOfLines={1}>
								{stamp.city ?? t("passportUnknownCity")}
							</Text>
							<Text style={[styles.stampMeta, { color: theme.mutedText }]}>
								{new Date(stamp.departureTime).toLocaleDateString(language, {
									day: "numeric",
									month: "short",
									year: "2-digit",
								})}
							</Text>
							<Text style={[styles.stampMeta, { color: theme.mutedText }]}>
								{Math.floor(stamp.duration / 60)} h {stamp.duration % 60} min
							</Text>
						</View>
					))}
				</ScrollView>
			) : null}

			{summary.flights > 0 ? (
				<Pressable
					style={[styles.share, { borderColor: theme.tint, backgroundColor: theme.accentSoft }]}
					onPress={handleShare}
					accessibilityRole="button"
				>
					<Ionicons name="share-social-outline" size={16} color={theme.tint} />
					<Text style={[styles.shareText, { color: theme.text }]}>{t("passportShare")}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function Total({
	value,
	label,
	theme,
}: {
	value: number;
	label: string;
	theme: (typeof Colors)["light"];
}) {
	return (
		<View style={styles.total} lightColor="transparent" darkColor="transparent" crazyColor="transparent">
			<Text style={[styles.totalValue, { color: theme.text }]}>{value}</Text>
			<Text style={[styles.totalLabel, { color: theme.mutedText }]} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	title: { fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 4 },
	hint: { fontSize: 12, lineHeight: 16, marginBottom: 10 },
	totals: {
		flexDirection: "row",
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingVertical: Spacing.md,
	},
	total: { flex: 1, alignItems: "center" },
	totalValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
	totalLabel: { fontSize: FontSize.xs, marginTop: 2 },
	// Padding so the rotated, dashed stamps are not clipped by the scroll view.
	stamps: { gap: Spacing.sm, padding: Spacing.sm, paddingVertical: Spacing.md },
	stamp: {
		width: 96,
		alignItems: "center",
		borderWidth: 2,
		borderStyle: "dashed",
		borderRadius: Radius.card,
		padding: Spacing.sm,
		transform: [{ rotate: "-3deg" }],
	},
	stampEmoji: { fontSize: 26 },
	stampCity: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: 4 },
	stampMeta: { fontSize: FontSize.xs },
	share: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: Radius.card,
		paddingVertical: Spacing.sm + 2,
	},
	shareText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
