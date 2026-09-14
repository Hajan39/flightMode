import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import AnimatedPressable from "@/components/AnimatedPressable";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import type { GameDefinition } from "@/data/games";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	game: GameDefinition;
	onPress: () => void;
};

/** Today's challenge card with the tint accent bar. */
export default function DailyChallengeCard({ game, onPress }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<AnimatedPressable
			style={[
				styles.card,
				{ backgroundColor: theme.accentSoft, borderColor: theme.tint },
				Shadow.card,
			]}
			onPress={onPress}
		>
			<View
				style={[styles.accent, { backgroundColor: theme.tint }]}
				lightColor="transparent"
				darkColor="transparent"
			/>
			<View style={styles.body} lightColor="transparent" darkColor="transparent">
				<View style={styles.top} lightColor="transparent" darkColor="transparent">
					<Ionicons name={game.icon as never} size={22} color={theme.tint} />
					<Text style={styles.title}>{t(game.titleKey)}</Text>
				</View>
				<Text style={[styles.description, { color: theme.mutedText }]}>
					{t(game.descriptionKey)}
				</Text>
				<View style={styles.ctaRow} lightColor="transparent" darkColor="transparent">
					<Text style={[styles.cta, { color: theme.tint }]}>
						{t("dailyChallengeCta")}
					</Text>
					<Ionicons name="arrow-forward" size={16} color={theme.tint} />
				</View>
			</View>
		</AnimatedPressable>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: Radius.panel + 4,
		padding: Spacing.lg,
		paddingLeft: Spacing.xl,
		marginBottom: 4,
		overflow: "hidden",
	},
	accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
	body: { gap: 8 },
	top: { flexDirection: "row", alignItems: "center", gap: 10 },
	title: { fontSize: 17, fontWeight: "700" },
	description: { fontSize: 14, lineHeight: 20 },
	ctaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
	cta: { fontSize: 13, fontWeight: "700" },
});
