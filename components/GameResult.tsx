import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { useColorScheme } from "@/components/useColorScheme";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	title: string;
	score: number;
	subtitle?: string;
	onPlayAgain: () => void;
};

export default function GameResult({
	title,
	score,
	subtitle,
	onPlayAgain,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();

	return (
		<Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
			<Animated.View
				entering={ZoomIn.delay(100).springify()}
				style={[
					styles.card,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Ionicons name="trophy-outline" size={40} color={theme.tint} />
				<Text style={[styles.title, { color: theme.text }]}>{title}</Text>
				<Text style={[styles.score, { color: theme.tint }]}>{score}</Text>
				{subtitle ? (
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{subtitle}
					</Text>
				) : null}
				<Pressable
					style={[styles.button, { backgroundColor: theme.tint }]}
					onPress={onPlayAgain}
				>
					<Ionicons name="refresh" size={20} color="#fff" />
					<Text style={styles.buttonText}>{t("playAgain")}</Text>
				</Pressable>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing["4xl"],
		zIndex: 10,
		backgroundColor: "rgba(0,0,0,0.4)",
	},
	card: {
		width: "100%",
		borderRadius: Radius.modal,
		borderWidth: 1,
		padding: Spacing["3xl"],
		alignItems: "center",
		gap: Spacing.sm,
		...Shadow.modal,
	},
	title: { ...TextStyle.cardTitle, fontSize: FontSize["2xl"], marginTop: Spacing.xs },
	score: { fontSize: FontSize["5xl"], fontWeight: FontWeight.black, letterSpacing: -1 },
	subtitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, textAlign: "center" },
	button: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		paddingHorizontal: Spacing["3xl"],
		paddingVertical: Spacing.md,
		borderRadius: Radius.button,
		marginTop: Spacing.md,
	},
	buttonText: {
		color: "#fff",
		fontSize: FontSize.md,
		fontWeight: FontWeight.bold,
	},
});
