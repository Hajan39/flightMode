import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, View as RNView, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { Text } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { rankStandings } from "@/utils/multiplayerScoring";

export type MatchStanding = {
	player: MatchPlayer;
	score: number;
	tiebreak?: number;
	/** Secondary text next to the score, e.g. "3 wins · 41 pts". */
	detail?: string;
};

type Props = {
	/** Overrides the default "{winner} wins!" / "Draw" headline (e.g. a cooperative tier). */
	title?: string;
	subtitle?: string;
	standings: MatchStanding[];
	/** null → draw. Usually `getSoleWinnerIndex(...)`. */
	winnerIndex: number | null;
	/** Column label for the score (e.g. "wins", "points"). */
	scoreLabel: string;
	/** Host's `recordMatch` result — shows streak / new-best line for seat 0. */
	progress?: GameProgressUpdate;
	/** Hide the ranking when everyone shares one result (cooperative games). */
	cooperative?: boolean;
	onRematch: () => void;
	onChangePlayers?: () => void;
	onQuit?: () => void;
	format?: (value: number) => string;
};

/**
 * Leaderboard variant of `GameResult` for multiplayer games: ranked players,
 * winner highlight, host streak line, and Rematch / Change players / Quit.
 */
export default function MatchResult({
	title,
	subtitle,
	standings,
	winnerIndex,
	scoreLabel,
	progress,
	cooperative,
	onRematch,
	onChangePlayers,
	onQuit,
	format = (v) => String(v),
}: Props) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const router = useRouter();
	const haptic = useHaptic();
	const reduceMotion = useReduceMotion();

	const hostWon = winnerIndex === 0;

	useEffect(() => {
		const timer = setTimeout(() => {
			if (hostWon || progress?.isNewBest) haptic.success();
			else haptic.heavy();
		}, 450);
		return () => clearTimeout(timer);
	}, [haptic, hostWon, progress?.isNewBest]);

	const ranked = rankStandings(
		standings.map((s) => ({ score: s.score, tiebreak: s.tiebreak })),
	).map((r) => ({ ...standings[r.index], rank: r.rank }));

	const winner = winnerIndex === null ? null : standings[winnerIndex]?.player;
	const headline =
		title ??
		(winner ? t("mpWins", { player: winner.name }) : t("mpDraw"));

	const handleQuit = () => {
		haptic.tap();
		if (onQuit) onQuit();
		else if (router.canGoBack()) router.back();
	};

	return (
		<Animated.View entering={FadeIn.delay(200).duration(200)} style={styles.overlay}>
			<Animated.View
				entering={
					reduceMotion
						? FadeIn.delay(280).duration(180)
						: ZoomIn.delay(280).duration(220)
				}
				style={[
					styles.card,
					{ backgroundColor: theme.elevated, borderColor: theme.border },
				]}
			>
				<RNView
					style={[
						styles.trophy,
						{ backgroundColor: winner ? `${winner.color}33` : theme.surface },
					]}
				>
					<Ionicons
						name={winner ? "trophy" : "people"}
						size={30}
						color={winner ? winner.color : theme.mutedText}
					/>
				</RNView>
				<Text style={[styles.title, { color: theme.text }]}>{headline}</Text>
				{subtitle ? (
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{subtitle}
					</Text>
				) : null}

				<ScrollView
					style={styles.tableScroll}
					contentContainerStyle={styles.table}
					showsVerticalScrollIndicator={false}
				>
					{ranked.map((row) => {
						const isWinner = row.player.index === winnerIndex;
						return (
							<RNView
								key={row.player.index}
								style={[
									styles.row,
									{
										backgroundColor: isWinner ? `${row.player.color}1F` : theme.card,
										borderColor: isWinner ? row.player.color : theme.border,
									},
								]}
								accessibilityLabel={`${cooperative ? "" : `#${row.rank} `}${row.player.name}: ${format(row.score)} ${scoreLabel}`}
							>
								{!cooperative ? (
									<Text style={[styles.rank, { color: theme.mutedText }]}>
										#{row.rank}
									</Text>
								) : null}
								<RNView style={[styles.dot, { backgroundColor: row.player.color }]} />
								<RNView style={styles.nameBlock}>
									<Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
										{row.player.name}
										{row.player.isHost ? (
											<Text style={[styles.youTag, { color: theme.mutedText }]}>
												{"  "}
												{t("mpYouHint")}
											</Text>
										) : null}
									</Text>
									{row.detail ? (
										<Text style={[styles.detail, { color: theme.mutedText }]} numberOfLines={1}>
											{row.detail}
										</Text>
									) : null}
								</RNView>
								<RNView style={styles.scoreBlock}>
									<Text style={[styles.score, { color: isWinner ? row.player.color : theme.text }]}>
										{format(row.score)}
									</Text>
									<Text style={[styles.scoreLabel, { color: theme.mutedText }]}>
										{scoreLabel}
									</Text>
								</RNView>
							</RNView>
						);
					})}
				</ScrollView>

				{progress ? (
					<RNView style={styles.hostLine}>
						{progress.isNewBest ? (
							<RNView style={[styles.newBest, { backgroundColor: theme.tint }]}>
								<Ionicons name="sparkles" size={12} color={theme.onTint} />
								<Text style={[styles.newBestText, { color: theme.onTint }]}>
									{t("gameNewBest")}
								</Text>
							</RNView>
						) : null}
						<Text style={[styles.hostText, { color: theme.mutedText }]}>
							{t("mpHostStats", {
								best: format(progress.best),
								streak: progress.currentStreak,
							})}
						</Text>
					</RNView>
				) : null}

				<RNView style={styles.actions}>
					<Pressable
						style={[styles.btnPrimary, { backgroundColor: theme.tint }]}
						onPress={() => {
							haptic.tap();
							onRematch();
						}}
						accessibilityRole="button"
						accessibilityLabel={t("mpRematch")}
					>
						<Ionicons name="refresh" size={20} color={theme.onTint} />
						<Text style={[styles.btnPrimaryText, { color: theme.onTint }]}>
							{t("mpRematch")}
						</Text>
					</Pressable>
					<RNView style={styles.secondaryRow}>
						{onChangePlayers ? (
							<Pressable
								style={[
									styles.btnSecondary,
									{ borderColor: theme.border, backgroundColor: theme.card },
								]}
								onPress={() => {
									haptic.tap();
									onChangePlayers();
								}}
								accessibilityRole="button"
								accessibilityLabel={t("mpChangePlayers")}
							>
								<Ionicons name="people-outline" size={18} color={theme.text} />
								<Text style={[styles.btnSecondaryText, { color: theme.text }]}>
									{t("mpChangePlayers")}
								</Text>
							</Pressable>
						) : null}
						<Pressable
							style={[
								styles.btnSecondary,
								{ borderColor: theme.border, backgroundColor: theme.card },
							]}
							onPress={handleQuit}
							accessibilityRole="button"
							accessibilityLabel={t("gameQuit")}
						>
							<Ionicons name="close" size={18} color={theme.mutedText} />
							<Text style={[styles.btnSecondaryText, { color: theme.text }]}>
								{t("gameQuit")}
							</Text>
						</Pressable>
					</RNView>
				</RNView>
			</Animated.View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
		zIndex: 10,
		backgroundColor: "rgba(0,0,0,0.55)",
	},
	card: {
		width: "100%",
		maxHeight: "92%",
		borderRadius: Radius.modal,
		borderWidth: 1,
		paddingTop: Spacing["2xl"],
		paddingBottom: Spacing.xl,
		paddingHorizontal: Spacing.xl,
		alignItems: "center",
		gap: Spacing.sm,
		...Shadow.modal,
	},
	trophy: {
		width: 60,
		height: 60,
		borderRadius: 30,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: FontSize["2xl"],
		fontWeight: FontWeight.black,
		textAlign: "center",
		marginTop: Spacing.xs,
	},
	subtitle: { ...TextStyle.hint, textAlign: "center" },
	tableScroll: { alignSelf: "stretch", flexGrow: 0, marginTop: Spacing.sm },
	table: { gap: Spacing.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.sm + 2,
		paddingHorizontal: Spacing.md,
		borderRadius: Radius.card,
		borderWidth: 1.5,
	},
	rank: { width: 26, fontSize: FontSize.sm, fontWeight: FontWeight.black },
	dot: { width: 12, height: 12, borderRadius: 6 },
	nameBlock: { flex: 1 },
	name: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold },
	youTag: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
	detail: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: 1 },
	scoreBlock: { alignItems: "flex-end" },
	score: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
	scoreLabel: { fontSize: FontSize.xs - 1, fontWeight: FontWeight.bold, textTransform: "uppercase" },
	hostLine: { alignItems: "center", gap: 6, marginTop: Spacing.sm },
	newBest: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: Spacing.md,
		paddingVertical: 4,
		borderRadius: Radius.pill,
	},
	newBestText: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.black,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	hostText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	actions: { alignSelf: "stretch", gap: Spacing.sm, marginTop: Spacing.md },
	btnPrimary: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingVertical: Spacing.md + 2,
		borderRadius: Radius.button,
	},
	btnPrimaryText: { ...TextStyle.buttonPrimary },
	secondaryRow: { flexDirection: "row", gap: Spacing.sm },
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
	btnSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
