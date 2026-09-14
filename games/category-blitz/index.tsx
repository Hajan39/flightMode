import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import {
	MatchResult,
	PassDeviceOverlay,
	PlayerScoreStrip,
	PlayerSetup,
	TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { ROUNDS_PER_PLAYER, TURN_SECONDS } from "@/data/categoryBlitzCategories";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

import { buildTurns, tallyScores, type Turn } from "./logic";

const GAME_ID = "category-blitz";
type Phase = "setup" | "pass" | "countdown" | "playing" | "turnEnd" | "done";

/**
 * Category Blitz — name as many things in the category as you can in 20 s.
 * The player says them out loud, the others judge, the phone just counts taps.
 * No word list, so it works in every UI language.
 */
export default function CategoryBlitzGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [turns, setTurns] = useState<Turn[]>([]);
	const [turnIndex, setTurnIndex] = useState(0);
	const [counts, setCounts] = useState<number[]>([]);
	const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	// Wall-clock deadline (CLAUDE.md timer rule) + a ref mirror for the timer tick.
	const deadlineRef = useRef<number | null>(null);
	const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const clearTick = () => {
		if (tickRef.current) clearInterval(tickRef.current);
		tickRef.current = null;
	};
	useEffect(() => clearTick, []);

	const turn = turns[turnIndex];
	const current = players[turn?.player ?? 0];
	const totals = tallyScores(turns, counts, players.length || 1);

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		clearTick();
		const built = buildTurns(matchPlayers.length);
		setPlayers(matchPlayers);
		setTurns(built);
		setCounts(Array(built.length).fill(0));
		setTurnIndex(0);
		setTimeLeft(TURN_SECONDS);
		setProgress(undefined);
		setPhase("pass");
	};

	const beginTurn = () => {
		deadlineRef.current = Date.now() + TURN_SECONDS * 1000;
		setTimeLeft(TURN_SECONDS);
		setPhase("playing");
	};

	useEffect(() => {
		if (phase !== "playing") return;
		const tick = () => {
			const deadline = deadlineRef.current;
			if (!deadline) return;
			const remainingMs = deadline - Date.now();
			setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
			if (remainingMs <= 0) {
				clearTick();
				deadlineRef.current = null;
				haptic.heavy();
				setPhase("turnEnd");
			}
		};
		tick();
		tickRef.current = setInterval(tick, 200);
		return clearTick;
	}, [phase, haptic]);

	const scorePoint = () => {
		if (phase !== "playing") return;
		haptic.tap();
		setCounts((prev) => {
			const next = [...prev];
			next[turnIndex] += 1;
			return next;
		});
	};

	const undoPoint = () => {
		if (phase !== "playing" || (counts[turnIndex] ?? 0) === 0) return;
		haptic.error();
		setCounts((prev) => {
			const next = [...prev];
			next[turnIndex] = Math.max(0, next[turnIndex] - 1);
			return next;
		});
	};

	const nextTurn = () => {
		haptic.tap();
		const next = turnIndex + 1;
		if (next >= turns.length) {
			const finalTotals = tallyScores(turns, counts, players.length);
			setProgress(recordMatch(GAME_ID, finalTotals.map((score) => ({ score }))));
			setPhase("done");
			return;
		}
		setTurnIndex(next);
		setPhase("pass");
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameCategoryBlitzName")}
				subtitle={t("cbzIntro", { seconds: TURN_SECONDS })}
				minPlayers={2}
				onStart={startMatch}
			/>
		);
	}

	const turnScore = counts[turnIndex] ?? 0;
	const timerColor =
		timeLeft <= 5 ? theme.danger : timeLeft <= 10 ? theme.warning : theme.text;

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={current}
					compact
					right={
						<Text style={[styles.roundChip, { color: theme.mutedText }]}>
							{t("mpRoundOf", {
								round: (turn?.round ?? 0) + 1,
								total: ROUNDS_PER_PLAYER,
							})}
						</Text>
					}
				/>
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={totals}
				activeIndex={phase === "playing" ? turn?.player : undefined}
			/>

			<RNView
				style={[
					styles.categoryCard,
					{ backgroundColor: theme.card, borderColor: current?.color ?? theme.border },
				]}
			>
				<Text style={[styles.categoryLabel, { color: theme.mutedText }]}>
					{t("cbzNameAsMany")}
				</Text>
				<Text style={[styles.categoryText, { color: theme.text }]}>
					{turn ? t(turn.category) : ""}
				</Text>
			</RNView>

			{phase === "playing" ? (
				<>
					<Text style={[styles.timer, { color: timerColor }]}>{timeLeft}s</Text>
					<Pressable
						style={[styles.scoreBtn, { backgroundColor: current.color }]}
						onPress={scorePoint}
						accessibilityRole="button"
						accessibilityLabel={t("cbzCountIt")}
					>
						<Animated.Text
							key={turnScore}
							entering={ZoomIn.duration(140)}
							style={styles.scoreValue}
						>
							{turnScore}
						</Animated.Text>
						<Text style={styles.scoreHint}>{t("cbzCountIt")}</Text>
					</Pressable>
					<Pressable
						onPress={undoPoint}
						disabled={turnScore === 0}
						accessibilityRole="button"
						accessibilityLabel={t("cbzUndo")}
						style={[
							styles.undoBtn,
							{ borderColor: theme.border, opacity: turnScore === 0 ? 0.4 : 1 },
						]}
					>
						<Ionicons name="arrow-undo-outline" size={16} color={theme.mutedText} />
						<Text style={[styles.undoText, { color: theme.mutedText }]}>
							{t("cbzUndo")}
						</Text>
					</Pressable>
				</>
			) : null}

			{phase === "turnEnd" ? (
				<Animated.View entering={FadeIn.duration(200)} style={styles.turnEnd}>
					<Text style={[styles.turnEndScore, { color: current.color }]}>
						+{turnScore}
					</Text>
					<Text style={[styles.turnEndText, { color: theme.mutedText }]}>
						{t("cbzTimeUp", { player: current.name })}
					</Text>
					<Pressable
						onPress={nextTurn}
						accessibilityRole="button"
						style={[styles.nextBtn, { backgroundColor: theme.tint }]}
					>
						<Text style={[styles.nextText, { color: theme.onTint }]}>
							{turnIndex + 1 >= turns.length ? t("hmSeeResult") : t("hmNextRound")}
						</Text>
					</Pressable>
				</Animated.View>
			) : null}

			{current ? (
				<PassDeviceOverlay
					visible={phase === "pass"}
					toPlayer={current}
					hint={t("cbzHandoff", { seconds: TURN_SECONDS })}
					onReady={() => setPhase("countdown")}
				/>
			) : null}
			{phase === "countdown" ? <GameCountdown onComplete={beginTurn} /> : null}

			{phase === "done" ? (
				<MatchResult
					standings={players.map((p, i) => ({ player: p, score: totals[i] }))}
					winnerIndex={getSoleWinnerIndex(totals.map((score) => ({ score })))}
					scoreLabel={t("cbzAnswers")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		padding: Spacing.lg,
		paddingTop: Spacing.sm,
		gap: Spacing.md,
		alignItems: "stretch",
	},
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	roundChip: { ...TextStyle.chipLabel },
	categoryCard: {
		borderWidth: 2,
		borderRadius: Radius.panel,
		padding: Spacing.xl,
		gap: Spacing.xs,
		alignItems: "center",
	},
	categoryLabel: { ...TextStyle.statLabel },
	categoryText: {
		fontSize: FontSize["2xl"],
		fontWeight: FontWeight.black,
		textAlign: "center",
		lineHeight: 30,
	},
	timer: { ...TextStyle.statValueLarge, textAlign: "center" },
	scoreBtn: {
		flex: 1,
		borderRadius: Radius.modal,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	scoreValue: {
		fontSize: 96,
		fontWeight: FontWeight.black,
		color: "#0b1620",
		lineHeight: 104,
	},
	scoreHint: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.extrabold,
		color: "#0b1620",
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	undoBtn: {
		flexDirection: "row",
		alignSelf: "center",
		alignItems: "center",
		gap: 6,
		borderWidth: 1,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
	},
	undoText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	turnEnd: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.sm },
	turnEndScore: { fontSize: FontSize["5xl"], fontWeight: FontWeight.black },
	turnEndText: { ...TextStyle.hint, textAlign: "center" },
	nextBtn: {
		marginTop: Spacing.lg,
		paddingHorizontal: Spacing["4xl"],
		paddingVertical: Spacing.md + 2,
		borderRadius: Radius.button,
	},
	nextText: { ...TextStyle.buttonSecondary },
});
