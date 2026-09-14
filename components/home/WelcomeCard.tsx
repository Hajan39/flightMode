import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { useTranslation } from "@/hooks/useTranslation";

type Props = { onPress: () => void };

/** Empty state for a brand-new profile (no game played yet). */
export default function WelcomeCard({ onPress }: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<View
			style={[
				styles.card,
				{ backgroundColor: theme.accentSoft, borderColor: theme.tint },
			]}
		>
			<Ionicons name="game-controller-outline" size={28} color={theme.tint} />
			<Text style={[styles.title, { color: theme.text }]}>
				{t("homeWelcomeTitle")}
			</Text>
			<Text style={[styles.hint, { color: theme.mutedText }]}>
				{t("homeWelcomeHint")}
			</Text>
			<Pressable onPress={onPress} style={[styles.btn, { backgroundColor: theme.tint }]}>
				<Text style={[styles.btnText, { color: theme.onTint }]}>
					{t("homeWelcomeCta")}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		alignItems: "center",
		padding: Spacing.xl,
		borderRadius: Radius.xl,
		borderWidth: 1.5,
		gap: 8,
		marginBottom: 6,
		...Shadow.card,
	},
	title: { fontSize: 18, fontWeight: "700" },
	hint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
	btn: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
	btnText: { fontSize: 14, fontWeight: "700" },
});
