import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, {
	FadeIn,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	ZoomIn,
} from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";

type Props = {
	title: string;
	score: number;
	subtitle?: string;
	onPlayAgain: () => void;
	/** Called when the user taps "Quit". Defaults to router.back(). */
	onQuit?: () => void;
	/** When true, displays a "🎉 New Best!" badge above the score. */
	isNewBest?: boolean;
	/** All-time best score for this game. */
	best?: number;
	/** Score from previous round, if different from current. */
	last?: number;
	/** Current win streak. */
	streak?: number;
	/** Optional formatter for any numeric stat (score / best / last). */
	formatScore?: (value: number) => string;
	/** Disable score-number bounce animation for calmer result screens. */
	disableScoreBounce?: boolean;
};

export default function GameResult({
	title,
	score,
	subtitle,
	onPlayAgain,
	onQuit,
	isNewBest,
	best,
	last,
	streak,
	formatScore,
	disableScoreBounce,
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const router = useRouter();
	const haptic = useHaptic();

	const scoreScale = useSharedValue(1);
	const scoreStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scoreScale.value }],
	}));

	useEffect(() => {
		// Delay so animation + haptic fire when card is fully visible (~450ms after mount)
		const timer = setTimeout(() => {
			if (!disableScoreBounce) {
				scoreScale.value = withSequence(
					withSpring(1.15, { damping: 8, stiffness: 180 }),
					withSpring(1, { damping: 10, stiffness: 220 }),
				);
			}
			if (isNewBest) haptic.success();
			else haptic.heavy();
		}, 450);
		return () => clearTimeout(timer);
	}, [disableScoreBounce, haptic, isNewBest, scoreScale]);

	const handleQuit = () => {
		haptic.tap();
		if (onQuit) onQuit();
		else if (router.canGoBack()) router.back();
	};

	const handlePlayAgain = () => {
		haptic.tap();
		onPlayAgain();
	};

	const fmt = formatScore ?? ((v: number) => String(v));

	const showStats =
		best !== undefined ||
		(last !== undefined && last !== score) ||
		(streak !== undefined && streak > 0);

	return (
		<Animated.View
			entering={FadeIn.delay(300).duration(200)}
			style={styles.overlay}
		>
			<Animated.View
				entering={ZoomIn.delay(380).springify().damping(14)}
				style={[
					styles.card,
					{ backgroundColor: theme.elevated, borderColor: theme.border },
				]}
			>
				{isNewBest ? (
					<Animated.View
						entering={ZoomIn.delay(280).springify()}
						style={[styles.newBestBadge, { backgroundColor: theme.tint }]}
					>
						<Ionicons name="sparkles" size={14} color="#fff" />
						<Text style={styles.newBestText}>{t("gameNewBest")}</Text>
					</Animated.View>
				) : (
					<Ionicons name="trophy-outline" size={32} color={theme.tint} />
				)}

				<Text style={[styles.title, { color: theme.text }]}>{title}</Text>

				<Animated.Text
					style={[styles.score, { color: theme.tint }, scoreStyle]}
				>
					{fmt(score)}
				</Animated.Text>

				{subtitle ? (
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{subtitle}
					</Text>
				) : null}

				{showStats ? (
					<RNView style={styles.statsRow}>
						{best !== undefined ? (
							<Stat
								label={t("gameBest")}
								value={fmt(best)}
								color={theme.text}
								mutedColor={theme.mutedText}
							/>
						) : null}
						{last !== undefined && last !== score ? (
							<>
								{best !== undefined ? (
									<RNView
										style={[
											styles.statDivider,
											{ backgroundColor: theme.border },
										]}
									/>
								) : null}
								<Stat
									label={t("gameLast")}
									value={fmt(last)}
									color={theme.text}
									mutedColor={theme.mutedText}
								/>
							</>
						) : null}
						{streak !== undefined && streak > 0 ? (
							<>
								<RNView
									style={[
										styles.statDivider,
										{ backgroundColor: theme.border },
									]}
								/>
								<Stat
									label={t("gameStreak")}
									value={`🔥 ${streak}`}
									color={theme.text}
									mutedColor={theme.mutedText}
								/>
							</>
						) : null}
					</RNView>
				) : null}

				<RNView style={styles.actions}>
					<Pressable
						style={[
							styles.btnSecondary,
							{ borderColor: theme.border, backgroundColor: theme.card },
						]}
						onPress={handleQuit}
					>
						<Ionicons name="close" size={18} color={theme.mutedText} />
						<Text style={[styles.btnSecondaryText, { color: theme.text }]}>
							{t("gameQuit")}
						</Text>
					</Pressable>
					<Pressable
						style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
						onPress={handlePlayAgain}
					>
						<Ionicons name="refresh" size={20} color="#fff" />
						<Text style={styles.btnPrimaryText}>{t("playAgain")}</Text>
					</Pressable>
				</RNView>
			</Animated.View>
		</Animated.View>
	);
}

function Stat({
	label,
	value,
	color,
	mutedColor,
}: {
	label: string;
	value: string;
	color: string;
	mutedColor: string;
}) {
	return (
		<RNView style={styles.statBlock}>
			<Text style={[styles.statLabel, { color: mutedColor }]}>{label}</Text>
			<Text style={[styles.statValue, { color }]}>{value}</Text>
		</RNView>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing["4xl"],
		zIndex: 10,
		backgroundColor: "rgba(0,0,0,0.55)",
	},
	card: {
		width: "100%",
		borderRadius: Radius.modal,
		borderWidth: 1,
		paddingTop: Spacing["3xl"],
		paddingBottom: Spacing.xl,
		paddingHorizontal: Spacing["3xl"],
		alignItems: "center",
		gap: Spacing.sm,
		...Shadow.modal,
	},
	newBestBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: Radius.pill,
	},
	newBestText: {
		color: "#fff",
		fontSize: FontSize.xs,
		fontWeight: FontWeight.black,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	title: {
		...TextStyle.cardTitle,
		fontSize: FontSize.xl,
		marginTop: Spacing.xs,
	},
	score: {
		fontSize: FontSize["5xl"],
		fontWeight: FontWeight.black,
		letterSpacing: -1,
		lineHeight: FontSize["5xl"] + 6,
	},
	subtitle: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		textAlign: "center",
		marginTop: -2,
	},
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: Spacing.md,
		marginBottom: Spacing.sm,
		alignSelf: "stretch",
	},
	statBlock: {
		flex: 1,
		alignItems: "center",
		gap: 2,
	},
	statLabel: {
		fontSize: 10,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: {
		fontSize: FontSize.lg,
		fontWeight: FontWeight.black,
	},
	statDivider: {
		width: 1,
		height: 32,
	},
	actions: {
		flexDirection: "row",
		gap: Spacing.sm,
		alignSelf: "stretch",
		marginTop: Spacing.md,
	},
	btnPrimary: {
		flex: 2,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.md,
		borderRadius: Radius.button,
	},
	btnPrimaryText: {
		color: "#fff",
		fontSize: FontSize.md,
		fontWeight: FontWeight.bold,
	},
	btnSecondary: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
		paddingVertical: Spacing.md,
		borderRadius: Radius.button,
		borderWidth: 1,
	},
	btnSecondaryText: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.bold,
	},
});
