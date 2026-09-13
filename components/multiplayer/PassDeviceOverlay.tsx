import { Ionicons } from "@expo/vector-icons";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	visible: boolean;
	toPlayer: MatchPlayer;
	/** Fully opaque + "Don't peek!" copy for games with hidden information. */
	secret?: boolean;
	/** Optional game-specific hint line under the title. */
	hint?: string;
	readyLabel?: string;
	onReady: () => void;
};

/**
 * Fullscreen hand-off screen for pass-and-play games. Always opaque so the
 * board underneath is hidden; `secret` adds the privacy warning.
 */
export default function PassDeviceOverlay({
	visible,
	toPlayer,
	secret,
	hint,
	readyLabel,
	onReady,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const reduceMotion = useReduceMotion();

	if (!visible) return null;

	const handleReady = () => {
		haptic.tap();
		onReady();
	};

	return (
		<Animated.View
			entering={
				reduceMotion ? FadeIn.duration(160) : SlideInRight.duration(260)
			}
			style={[styles.overlay, { backgroundColor: theme.background }]}
			accessibilityViewIsModal
		>
			<RNView style={[styles.dot, { backgroundColor: toPlayer.color }]}>
				<Ionicons name="phone-portrait-outline" size={40} color="#0b1620" />
			</RNView>
			<Text style={[styles.eyebrow, { color: theme.mutedText }]}>
				{t("passPhone")}
			</Text>
			<Text style={[styles.title, { color: theme.text }]}>
				{t("passPhoneTo", { player: toPlayer.name })}
			</Text>
			{secret ? (
				<RNView
					style={[
						styles.secretPill,
						{ backgroundColor: theme.dangerSurface, borderColor: theme.dangerBorder },
					]}
				>
					<Ionicons name="eye-off-outline" size={16} color={theme.danger} />
					<Text style={[styles.secretText, { color: theme.danger }]}>
						{t("passPhoneDontLook")}
					</Text>
				</RNView>
			) : null}
			{hint ? (
				<Text style={[styles.hint, { color: theme.mutedText }]}>{hint}</Text>
			) : null}
			<Pressable
				onPress={handleReady}
				style={[styles.btn, { backgroundColor: toPlayer.color }]}
				accessibilityRole="button"
				accessibilityLabel={readyLabel ?? t("passPhoneReady")}
			>
				<Text style={styles.btnText}>{readyLabel ?? t("passPhoneReady")}</Text>
			</Pressable>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		zIndex: 30,
		alignItems: "center",
		justifyContent: "center",
		padding: Spacing["4xl"],
		gap: Spacing.md,
	},
	dot: {
		width: 96,
		height: 96,
		borderRadius: 48,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.sm,
	},
	eyebrow: { ...TextStyle.statLabel },
	title: {
		fontSize: FontSize["2xl"],
		fontWeight: FontWeight.black,
		textAlign: "center",
	},
	secretPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
	},
	secretText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	hint: { ...TextStyle.hint, textAlign: "center", paddingHorizontal: Spacing.md },
	btn: {
		marginTop: Spacing.lg,
		paddingHorizontal: Spacing["4xl"],
		paddingVertical: Spacing.lg,
		borderRadius: Radius.button,
		alignSelf: "stretch",
		alignItems: "center",
	},
	btnText: { ...TextStyle.buttonPrimary, color: "#0b1620" },
});
