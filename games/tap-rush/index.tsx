import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import GameResult from "@/components/GameResult";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const ROUND_SECONDS = 20;

export default function TapRushGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [isRunning, setIsRunning] = useState(false);
	const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
	const [score, setScore] = useState(0);
	const [showResult, setShowResult] = useState(false);
	const scoreRef = useRef(0);
	const gameEndedAt = useRef(0);

	useEffect(() => {
		if (!isRunning) return;

		if (secondsLeft <= 0) {
			setIsRunning(false);
			haptic.heavy();
			updateProgress("tap-rush", scoreRef.current);
			gameEndedAt.current = Date.now();
			setShowResult(true);
			return;
		}

		const timeout = setTimeout(() => {
			setSecondsLeft((prev) => prev - 1);
		}, 1000);

		return () => clearTimeout(timeout);
	}, [isRunning, secondsLeft, updateProgress]);

	const ctaLabel = (() => {
		if (!isRunning && score === 0 && secondsLeft === ROUND_SECONDS)
			return t("tapRushStart");
		if (isRunning) return t("tapRushTap");
		return t("tapRushPlayAgain");
	})();

	const handleMainPress = () => {
		if (showResult && Date.now() - gameEndedAt.current < 700) return;
		if (!isRunning && secondsLeft === ROUND_SECONDS && score === 0) {
			setIsRunning(true);
			return;
		}
		if (isRunning) {
			haptic.tap();
			setScore((prev) => {
				scoreRef.current = prev + 1;
				return prev + 1;
			});
			return;
		}
		setSecondsLeft(ROUND_SECONDS);
		setScore(0);
		scoreRef.current = 0;
		setShowResult(false);
		setIsRunning(true);
	};

	const progress = secondsLeft / ROUND_SECONDS;

	return (
		<View style={styles.root}>
			{/* ── Time bar ── */}
			<View style={[styles.timeTrack, { backgroundColor: theme.card }]}>
				<View
					style={[
						styles.timeFill,
						{ backgroundColor: theme.tint, flex: progress },
					]}
				/>
			</View>

			{/* ── Stats ── */}
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("tapRushTime")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{secondsLeft}s
					</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("tapRushScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</View>
			</View>

			{/* ── Main tap area ── */}
			<Pressable
				style={[
					styles.tapArea,
					{
						backgroundColor: isRunning ? theme.tint : theme.elevated,
						borderColor: isRunning ? theme.tint : theme.border,
					},
				]}
				onPress={handleMainPress}
			>
				<Text
					style={[
						styles.tapLabel,
						{ color: isRunning ? "#fff" : theme.mutedText },
					]}
				>
					{ctaLabel}
				</Text>
			</Pressable>

			{showResult && (
				<GameResult
					title={t("tapRushFinishedTitle")}
					score={score}
					onPlayAgain={handleMainPress}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
	/* ── Time bar ── */
	timeTrack: {
		height: 6,
		borderRadius: 999,
		flexDirection: "row",
		overflow: "hidden",
	},
	timeFill: { borderRadius: 999 },
	/* ── Stats ── */
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 0,
	},
	statBlock: { flex: 1, alignItems: "center", gap: 4 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
	statDivider: { width: 1, height: 50 },
	/* ── Tap area ── */
	tapArea: {
		flex: 1,
		borderRadius: 24,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 220,
	},
	tapLabel: {
		fontSize: 30,
		fontWeight: "900",
		letterSpacing: 2,
		textTransform: "uppercase",
	},
});
