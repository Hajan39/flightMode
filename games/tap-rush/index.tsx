import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";

const ROUND_SECONDS = 20;

type Phase = "idle" | "countdown" | "running" | "paused" | "over";

export default function TapRushGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBest = useGameStore(
		(s) => s.progress["tap-rush"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("idle");
	const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
	const [score, setScore] = useState(0);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);
	const scoreRef = useRef(0);
	const endTimeRef = useRef<number | null>(null);
	const lastTapHapticAtRef = useRef(0);

	const tapAreaScale = useSharedValue(1);
	const scoreScale = useSharedValue(1);

	const tapAreaAnimStyle = useAnimatedStyle(() => ({
		transform: [{ scale: tapAreaScale.value }],
	}));
	const scoreAnimStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scoreScale.value }],
	}));

	useEffect(() => {
		if (phase !== "running") return;

		const tick = () => {
			const endTime = endTimeRef.current;
			if (!endTime) return;

			const remainingMs = endTime - Date.now();
			const nextSecondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
			setSecondsLeft(nextSecondsLeft);

			if (remainingMs <= 0) {
				haptic.heavy();
				const info = updateProgress("tap-rush", scoreRef.current);
				setProgressInfo(info);
				setPhase("over");
			}
		};

		tick();
		const interval = setInterval(tick, 100);

		return () => clearInterval(interval);
	}, [phase, updateProgress, haptic]);

	const startCountdown = () => {
		setSecondsLeft(ROUND_SECONDS);
		setScore(0);
		scoreRef.current = 0;
		endTimeRef.current = null;
		setProgressInfo(null);
		setPhase("countdown");
	};

	const handleTap = () => {
		if (phase !== "running") return;

		const now = Date.now();
		if (now - lastTapHapticAtRef.current >= 60) {
			lastTapHapticAtRef.current = now;
			haptic.tap();
		}

		scoreRef.current += 1;
		setScore(scoreRef.current);

		// Quick bounce on the tap area + score bump
		tapAreaScale.value = withSequence(
			withTiming(0.97, { duration: 50, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) }),
		);
		scoreScale.value = withSequence(
			withTiming(1.18, { duration: 70, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
		);
	};

	const handlePause = () => {
		if (phase === "running") setPhase("paused");
	};
	const handleResume = () => {
		if (phase === "paused") setPhase("running");
	};
	const handleReset = () => {
		setSecondsLeft(ROUND_SECONDS);
		setScore(0);
		scoreRef.current = 0;
		endTimeRef.current = null;
		setProgressInfo(null);
		setPhase("idle");
	};

	const progress = secondsLeft / ROUND_SECONDS;
	const isRunning = phase === "running";

	const ctaLabel =
		phase === "idle"
			? t("gameTapToStart")
			: isRunning
				? t("tapRushTap")
				: phase === "paused"
					? t("gameResume")
					: t("playAgain");

	return (
		<View style={styles.root}>
			<RNView style={styles.headerRow}>
				<RNView style={[styles.bestPill, { backgroundColor: theme.card }]}>
					<Text style={[styles.bestLabel, { color: theme.mutedText }]}>
						{t("gameBest")}
					</Text>
					<Text style={[styles.bestValue, { color: theme.tint }]}>
						{storedBest}
					</Text>
				</RNView>
				<GameControls
					onPause={isRunning || phase === "paused" ? handlePause : undefined}
					onReset={phase !== "idle" ? handleReset : undefined}
					isPaused={phase === "paused"}
				/>
			</RNView>

			{/* ── Time bar ── */}
			<RNView style={[styles.timeTrack, { backgroundColor: theme.card }]}>
				<RNView
					style={[
						styles.timeFill,
						{
							backgroundColor: secondsLeft <= 5 ? theme.danger : theme.tint,
							flex: progress,
						},
					]}
				/>
			</RNView>

			{/* ── Stats ── */}
			<RNView style={styles.statsRow}>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("tapRushTime")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{secondsLeft}s
					</Text>
				</RNView>
				<RNView
					style={[styles.statDivider, { backgroundColor: theme.border }]}
				/>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("tapRushScore")}
					</Text>
					<Animated.View style={scoreAnimStyle}>
						<Text style={[styles.statValue, { color: theme.tint }]}>
							{score}
						</Text>
					</Animated.View>
				</RNView>
			</RNView>

			{/* ── Main tap area ── */}
			<Animated.View style={[styles.tapAreaWrap, tapAreaAnimStyle]}>
				<Pressable
					style={[
						styles.tapArea,
						{
							backgroundColor: isRunning ? theme.tint : theme.elevated,
							borderColor: isRunning ? theme.tint : theme.border,
						},
					]}
					onPressIn={isRunning ? handleTap : startCountdown}
					disabled={
						phase === "countdown" || phase === "paused" || phase === "over"
					}
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
			</Animated.View>

			{phase === "countdown" && (
				<GameCountdown
					onComplete={() => {
						endTimeRef.current = Date.now() + ROUND_SECONDS * 1000;
						setSecondsLeft(ROUND_SECONDS);
						setPhase("running");
					}}
				/>
			)}

			<GamePauseOverlay
				visible={phase === "paused"}
				onResume={handleResume}
				onRestart={() => {
					handleReset();
					startCountdown();
				}}
			/>

			{phase === "over" && (
				<GameResult
					title={t("tapRushFinishedTitle")}
					score={score}
					best={progressInfo?.best ?? storedBest}
					last={progressInfo?.previousBest}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					onPlayAgain={startCountdown}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	bestPill: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
	},
	bestLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	bestValue: { fontSize: 16, fontWeight: "900" },
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
	tapAreaWrap: { flex: 1 },
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
