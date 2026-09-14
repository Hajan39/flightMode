import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	gamesPlayed: number;
	flights: number;
	achievementsUnlocked: number;
	achievementsTotal: number;
	onOpenProfile: () => void;
};

/** Three-stat snapshot card with a profile link. */
export default function StatsSnapshot({
	gamesPlayed,
	flights,
	achievementsUnlocked,
	achievementsTotal,
	onOpenProfile,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	const stats = [
		{ key: "games", value: String(gamesPlayed), label: t("profileGamesPlayed") },
		{ key: "flights", value: String(flights), label: t("profileFlights") },
		{
			key: "achievements",
			value: `${achievementsUnlocked}/${achievementsTotal}`,
			label: t("profileAchievements"),
		},
	];

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.card, borderColor: theme.border },
			]}
		>
			<View style={styles.row} lightColor="transparent" darkColor="transparent">
				{stats.map((stat) => (
					<View
						key={stat.key}
						style={styles.item}
						lightColor="transparent"
						darkColor="transparent"
					>
						<Text style={[styles.value, { color: theme.text }]}>{stat.value}</Text>
						<Text style={[styles.label, { color: theme.mutedText }]}>
							{stat.label}
						</Text>
					</View>
				))}
			</View>
			<AnimatedPressable
				style={[styles.profileCta, { borderColor: theme.border }]}
				onPress={onOpenProfile}
			>
				<Ionicons name="person-circle-outline" size={18} color={theme.tint} />
				<Text style={[styles.profileCtaText, { color: theme.tint }]}>
					{t("stackProfile")}
				</Text>
			</AnimatedPressable>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: Radius.panel,
		padding: Spacing.lg,
		gap: 12,
		marginBottom: 6,
		...Shadow.card,
	},
	row: { flexDirection: "row", gap: 10 },
	item: { flex: 1, alignItems: "center" },
	value: { fontSize: 18, fontWeight: "800" },
	label: { fontSize: 11, textAlign: "center", marginTop: 2 },
	profileCta: {
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
		gap: 6,
	},
	profileCtaText: { fontSize: 13, fontWeight: "700" },
});
