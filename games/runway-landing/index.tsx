import GameControls from "@/components/GameControls";
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
	ZoomIn,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";

const ROUND_COUNT = 8;
const RUNWAY_WIDTH = 280;
const BASE_TARGET_WIDTH = 72;
const BASE_SPEED = 8;

/** Target zone shrinks slightly each round */
function getTargetWidth(round: number) {
	const step = round - 1;
	const shrink = step * 4 + Math.floor(step / 2) * 2;
	return Math.max(30, BASE_TARGET_WIDTH - shrink);
}

/** Marker speed increases each round */
function getSpeed(round: number) {
	const step = round - 1;
	return BASE_SPEED + step * 1.2 + Math.floor(step / 3) * 0.9;
}

function getTargetLeft(targetWidth: number) {
	return 24 + Math.random() * (RUNWAY_WIDTH - targetWidth - 48);
}

type Quality = "perfect" | "great" | "good" | "miss";

function getQuality(points: number): Quality {
	if (points >= 90) return "perfect";
	if (points >= 60) return "great";
	if (points >= 30) return "good";
	return "miss";
}

function getQualityColor(q: Quality): string {
	switch (q) {
		case "perfect":
			return "#4fc3f7";
		case "great":
			return "#66bb6a";
		case "good":
			return "#ffa726";
		case "miss":
			return "#ef5350";
	}
}

export default function RunwayLandingGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBest = useGameStore(
		(s) => s.progress["runway-landing"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [round, setRound] = useState(1);
	const [score, setScore] = useState(0);
	const [markerX, setMarkerX] = useState(0);
	const [direction, setDirection] = useState(1);
	const targetWidth = getTargetWidth(round);
	const [targetLeft, setTargetLeft] = useState(() =>
		getTargetLeft(targetWidth),
	);
	const [finished, setFinished] = useState(false);
	const [paused, setPaused] = useState(false);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);
	const [lastPoints, setLastPoints] = useState<number | null>(null);
	const [lastQuality, setLastQuality] = useState<Quality | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Synchronous game-over guard: React state (`finished`) does not flush
	// between two fast taps on the final round, so guard scoring with a ref to
	// prevent updateProgress() firing twice.
	const finishedRef = useRef(false);
	const speed = getSpeed(round);

	// Cancel any pending feedback timer on unmount.
	useEffect(() => {
		return () => {
			if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
		};
	}, []);

	// Touchdown feedback: subtle pulse on the runway card
	const runwayPulse = useSharedValue(1);
	const runwayPulseStyle = useAnimatedStyle(() => ({
		transform: [{ scale: runwayPulse.value }],
	}));

	useEffect(() => {
		if (finished || paused) return;
		intervalRef.current = setInterval(() => {
			setMarkerX((prev) => {
				const next = prev + direction * speed;
				if (next <= 0) {
					setDirection(1);
					return 0;
				}
				if (next >= RUNWAY_WIDTH - 12) {
					setDirection(-1);
					return RUNWAY_WIDTH - 12;
				}
				return next;
			});
		}, 32);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [direction, speed, finished, paused]);

	const currentRoundText = `${round}/${ROUND_COUNT}`;

	const qualityKey = (q: Quality) => {
		switch (q) {
			case "perfect":
				return t("rlPerfect");
			case "great":
				return t("rlGreat");
			case "good":
				return t("rlGood");
			case "miss":
				return t("rlMiss");
		}
	};

	const restart = () => {
		if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
		finishedRef.current = false;
		setRound(1);
		setScore(0);
		setMarkerX(0);
		setDirection(1);
		setTargetLeft(getTargetLeft(getTargetWidth(1)));
		setFinished(false);
		setPaused(false);
		setLastPoints(null);
		setLastQuality(null);
		setProgressInfo(null);
	};

	const handleLand = () => {
		if (finished || finishedRef.current) return;

		const center = markerX + 6;
		const targetCenter = targetLeft + targetWidth / 2;
		const dist = Math.abs(center - targetCenter);
		const points = Math.max(0, 100 - Math.round(dist * 1.2));
		const quality = getQuality(points);
		const nextScore = score + points;
		const nextRound = round + 1;

		if (quality === "perfect") haptic.success();
		else if (quality === "miss") haptic.error();
		else haptic.heavy();

		runwayPulse.value = withSequence(
			withTiming(quality === "miss" ? 0.98 : 1.03, { duration: 90 }),
			withTiming(1, { duration: 140 }),
		);

		setScore(nextScore);
		setLastPoints(points);
		setLastQuality(quality);

		// Clear previous timer
		if (feedbackTimer.current) clearTimeout(feedbackTimer.current);

		if (nextRound > ROUND_COUNT) {
			finishedRef.current = true;
			setFinished(true);
			const info = updateProgress("runway-landing", nextScore);
			setProgressInfo(info);
			return;
		}

		feedbackTimer.current = setTimeout(() => {
			setRound(nextRound);
			const tw = getTargetWidth(nextRound);
			setTargetLeft(getTargetLeft(tw));
			setLastPoints(null);
			setLastQuality(null);
		}, 800);
	};

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
					onPause={!finished ? () => setPaused(true) : undefined}
					onReset={restart}
					isPaused={paused}
				/>
			</RNView>

			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("rlRound")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{currentRoundText}
					</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("rlScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</View>
			</View>

			<Animated.View
				style={[
					styles.runwayCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
					runwayPulseStyle,
				]}
			>
				{/* Quality feedback or hint */}
				{lastQuality ? (
					<Animated.View entering={ZoomIn.duration(150)}>
						<Text
							style={[
								styles.qualityText,
								{ color: getQualityColor(lastQuality) },
							]}
						>
							{qualityKey(lastQuality)}{" "}
							<Text style={styles.qualityPoints}>+{lastPoints}</Text>
						</Text>
					</Animated.View>
				) : (
					<Text style={[styles.helper, { color: theme.mutedText }]}>
						{t("rlTapHint")}
					</Text>
				)}

				<View style={[styles.runway, { backgroundColor: theme.elevated }]}>
					<View
						style={[
							styles.targetZone,
							{
								left: targetLeft,
								width: targetWidth,
								backgroundColor: theme.accentSoft,
								borderColor: theme.tint,
							},
						]}
					/>
					<View
						style={[
							styles.marker,
							{ left: markerX, backgroundColor: theme.tint },
						]}
					/>
				</View>

				{/* Speed indicator */}
				<Text style={[styles.speedHint, { color: theme.mutedText }]}>
					{"▸".repeat(Math.min(round, ROUND_COUNT))}
				</Text>
			</Animated.View>

			<Pressable
				style={[
					styles.button,
					{
						backgroundColor: theme.tint,
						opacity: finished ? 0.5 : 1,
					},
				]}
				onPress={handleLand}
				disabled={finished}
				accessibilityRole="button"
				accessibilityLabel={t("rlLand")}
			>
				<Text style={[styles.buttonText, { color: theme.onTint }]}>{t("rlLand")}</Text>
			</Pressable>

			{finished && (
				<GameResult
					title={t("rlFinished")}
					score={score}
					best={progressInfo?.best ?? storedBest}
					last={progressInfo?.previousBest}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					subtitle={t("rlResult", { score })}
					onPlayAgain={restart}
				/>
			)}

			<GamePauseOverlay
				visible={paused}
				onResume={() => setPaused(false)}
				onRestart={restart}
			/>
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
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
	statDivider: { width: 1, height: 56 },
	runwayCard: {
		borderRadius: 16,
		borderWidth: 1,
		padding: 14,
		alignItems: "center",
		gap: 12,
	},
	helper: { fontSize: 13, fontWeight: "600" },
	qualityText: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
	qualityPoints: { fontSize: 14, fontWeight: "700" },
	speedHint: { fontSize: 11, letterSpacing: 3 },
	runway: {
		width: RUNWAY_WIDTH,
		height: 56,
		borderRadius: 10,
		overflow: "hidden",
		justifyContent: "center",
	},
	targetZone: {
		position: "absolute",
		height: 40,
		top: 8,
		borderWidth: 1,
		borderRadius: 8,
	},
	marker: {
		position: "absolute",
		top: 6,
		width: 12,
		height: 44,
		borderRadius: 6,
	},
	button: {
		alignItems: "center",
		paddingVertical: 16,
		borderRadius: 14,
	},
	buttonText: {
		fontSize: 20,
		fontWeight: "900",
		letterSpacing: 1,
	},
});
