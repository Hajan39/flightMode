import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
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
		<View style={styles.overlay}>
			<View
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
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
		zIndex: 10,
	},
	card: {
		width: "100%",
		borderRadius: 20,
		borderWidth: 1,
		padding: 28,
		alignItems: "center",
		gap: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.12,
		shadowRadius: 12,
		elevation: 8,
	},
	title: { fontSize: 22, fontWeight: "800", marginTop: 4 },
	score: { fontSize: 48, fontWeight: "900", letterSpacing: -1 },
	subtitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
	button: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 28,
		paddingVertical: 14,
		borderRadius: 14,
		marginTop: 12,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
	},
});
