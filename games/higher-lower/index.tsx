import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View as RNView } from "react-native";
import Animated, {
	ZoomIn,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";

const TOTAL_ROUNDS = 10;
const MIN_NUM = 1;
const MAX_NUM = 12;
const FEEDBACK_DELAY_MS = 400;

type Phase = "idle" | "playing" | "feedback" | "over";
type ButtonFlash = "correct" | "wrong" | null;

function randomNumber(exclude?: number): number {
	let n: number;
	do {
		n = Math.floor(Math.random() * (MAX_NUM - MIN_NUM + 1)) + MIN_NUM;
	} while (n === exclude);
	return n;
}

export default function HigherLowerGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBest = useGameStore(
		(s) => s.progress["higher-lower"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("idle");
	const [currentNumber, setCurrentNumber] = useState<number>(0);
	const [previousNumber, setPreviousNumber] = useState<number | null>(null);
	const [round, setRound] = useState(0);
	const [score, setScore] = useState(0);
	const [higherFlash, setHigherFlash] = useState<ButtonFlash>(null);
	const [lowerFlash, setLowerFlash] = useState<ButtonFlash>(null);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);

	// Feedback animation: subtle pulse on correct, shake on wrong
	const cardScale = useSharedValue(1);
	const cardShake = useSharedValue(0);
	const cardFeedbackStyle = useAnimatedStyle(() => ({
		transform: [{ scale: cardScale.value }, { translateX: cardShake.value }],
	}));

	const scoreRef = useRef(0);
	const roundRef = useRef(0);
	const currentNumberRef = useRef(0);
	const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
		};
	}, []);

	const startGame = () => {
		if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
		scoreRef.current = 0;
		roundRef.current = 1;
		setScore(0);
		setRound(1);
		setProgressInfo(null);
		setHigherFlash(null);
		setLowerFlash(null);
		setPreviousNumber(null);

		const first = randomNumber();
		currentNumberRef.current = first;
		setCurrentNumber(first);
		setPhase("playing");
	};

	const handleGuess = (guess: "higher" | "lower") => {
		if (phase !== "playing") return;

		setPhase("feedback");

		const prev = currentNumberRef.current;
		const next = randomNumber(prev);
		const isHigher = next > prev;
		const isLower = next < prev;
		const isCorrect =
			(guess === "higher" && isHigher) || (guess === "lower" && isLower);

		if (isCorrect) {
			haptic.success();
			cardScale.value = withSequence(
				withTiming(1.04, { duration: 100 }),
				withTiming(1, { duration: 130 }),
			);
			scoreRef.current += 1;
			setScore(scoreRef.current);
			if (guess === "higher") {
				setHigherFlash("correct");
			} else {
				setLowerFlash("correct");
			}
		} else {
			haptic.error();
			cardShake.value = withSequence(
				withTiming(-6, { duration: 50 }),
				withTiming(6, { duration: 50 }),
				withTiming(0, { duration: 50 }),
			);
			if (guess === "higher") {
				setHigherFlash("wrong");
			} else {
				setLowerFlash("wrong");
			}
		}

		const currentRound = roundRef.current;
		const isLastRound = currentRound >= TOTAL_ROUNDS;

		feedbackTimerRef.current = setTimeout(() => {
			setHigherFlash(null);
			setLowerFlash(null);
			setPreviousNumber(prev);
			currentNumberRef.current = next;
			setCurrentNumber(next);

			if (isLastRound) {
				const info = updateProgress("higher-lower", scoreRef.current);
				setProgressInfo(info);
				setPhase("over");
			} else {
				roundRef.current = currentRound + 1;
				setRound(roundRef.current);
				setPhase("playing");
			}
		}, FEEDBACK_DELAY_MS);
	};

	const handleReset = () => {
		if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
		setPhase("idle");
		setCurrentNumber(0);
		setPreviousNumber(null);
		setRound(0);
		setScore(0);
		scoreRef.current = 0;
		roundRef.current = 0;
		setHigherFlash(null);
		setLowerFlash(null);
		setProgressInfo(null);
	};

	const isPlaying = phase === "playing" || phase === "feedback";

	const getButtonColor = (flash: ButtonFlash, activeColor: string): string => {
		if (flash === "correct") return theme.successBorder;
		if (flash === "wrong") return theme.danger;
		return activeColor;
	};

	return (
		<View style={styles.root}>
			{/* ── Header ── */}
			<RNView style={styles.headerRow}>
				<GameControls
					onReset={phase !== "idle" ? handleReset : undefined}
				/>
			</RNView>

			{/* ── Score + Round ── */}
			<RNView style={styles.statsRow}>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("tapRushScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>
						{score}
					</Text>
				</RNView>
				<RNView
					style={[styles.statDivider, { backgroundColor: theme.border }]}
				/>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("hlRound")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{isPlaying ? `${round}/${TOTAL_ROUNDS}` : "—"}
					</Text>
				</RNView>
			</RNView>

			{/* ── Number card ── */}
			<Animated.View
				style={[
					styles.numberCard,
					{ backgroundColor: theme.elevated, borderColor: theme.border },
					cardFeedbackStyle,
				]}
			>
				{phase === "idle" ? (
					<>
						<Text style={[styles.numberText, { color: theme.mutedText }]}>
							?
						</Text>
						<Text style={[styles.idleHint, { color: theme.mutedText }]}>
							{t("gameTapToStart")}
						</Text>
					</>
				) : (
					<>
						<Animated.View
							key={`${round}-${currentNumber}`}
							entering={ZoomIn.duration(150)}
						>
							<Text style={[styles.numberText, { color: theme.text }]}>
								{currentNumber}
							</Text>
						</Animated.View>
						{previousNumber !== null && (
							<Text style={[styles.previousHint, { color: theme.mutedText }]}>
								{t("hlPrevious").replace("{{n}}", String(previousNumber))}
							</Text>
						)}
					</>
				)}
			</Animated.View>

			{/* ── Buttons ── */}
			<RNView style={styles.buttonsRow}>
				<Pressable
					style={[
						styles.guessButton,
						{
							backgroundColor: getButtonColor(
								higherFlash,
								isPlaying ? theme.successBorder : theme.elevated,
							),
							borderColor: isPlaying ? theme.successBorder : theme.border,
							opacity: phase === "feedback" ? 0.85 : 1,
						},
					]}
					onPress={() => handleGuess("higher")}
					disabled={phase !== "playing"}
					accessibilityRole="button"
					accessibilityLabel={t("hlHigher")}
				>
					<Text
						style={[
							styles.guessButtonText,
							{ color: isPlaying ? theme.onTint : theme.mutedText },
						]}
					>
						{t("hlHigher")}
					</Text>
				</Pressable>

				<Pressable
					style={[
						styles.guessButton,
						{
							backgroundColor: getButtonColor(
								lowerFlash,
								isPlaying ? theme.tint : theme.elevated,
							),
							borderColor: isPlaying ? theme.tint : theme.border,
							opacity: phase === "feedback" ? 0.85 : 1,
						},
					]}
					onPress={() => handleGuess("lower")}
					disabled={phase !== "playing"}
					accessibilityRole="button"
					accessibilityLabel={t("hlLower")}
				>
					<Text
						style={[
							styles.guessButtonText,
							{ color: isPlaying ? theme.onTint : theme.mutedText },
						]}
					>
						{t("hlLower")}
					</Text>
				</Pressable>
			</RNView>

			{/* ── Start button (idle only) ── */}
			{phase === "idle" && (
				<Pressable
					style={[styles.startButton, { backgroundColor: theme.tint }]}
					onPress={startGame}
					accessibilityRole="button"
					accessibilityLabel={t("gameTapToStart")}
				>
					<Text style={[styles.startButtonText, { color: theme.onTint }]}>{t("gameTapToStart")}</Text>
				</Pressable>
			)}

			{/* ── Game Result ── */}
			{phase === "over" && (
				<GameResult
					title={t("gameHigherLowerName")}
					score={score}
					best={progressInfo?.best ?? storedBest}
					last={progressInfo?.previousBest}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					onPlayAgain={startGame}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16 },
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
	},
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 4 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
	statDivider: { width: 1, height: 56 },
	numberCard: {
		flex: 1,
		borderRadius: 24,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 180,
		gap: 8,
	},
	numberText: {
		fontSize: 96,
		fontWeight: "900",
		letterSpacing: -4,
		lineHeight: 104,
	},
	idleHint: {
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
	},
	previousHint: {
		fontSize: 15,
		fontWeight: "600",
	},
	buttonsRow: {
		flexDirection: "row",
		gap: 12,
	},
	guessButton: {
		flex: 1,
		paddingVertical: 22,
		borderRadius: 18,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	guessButtonText: {
		fontSize: 18,
		fontWeight: "900",
		letterSpacing: 0.5,
	},
	startButton: {
		paddingVertical: 16,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	startButtonText: {
		fontSize: 18,
		fontWeight: "900",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
});
