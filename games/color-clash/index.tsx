import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

// ── Constants ────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 20;
const ROUND_MS = 1800;
const FEEDBACK_MS = 350;
const MATCH_PROBABILITY = 0.4;

// ── Color definitions ─────────────────────────────────────────────────────────
type ColorEntry = {
	key: TranslationKey;
	hex: string;
};

const COLORS: ColorEntry[] = [
	{ key: "colorRed", hex: "#E53935" },
	{ key: "colorBlue", hex: "#1E88E5" },
	{ key: "colorGreen", hex: "#43A047" },
	{ key: "colorYellow", hex: "#E6C200" },
	{ key: "colorPurple", hex: "#8E24AA" },
	{ key: "colorOrange", hex: "#FB8C00" },
];

type Trial = {
	word: TranslationKey; // color name key
	textColor: string; // hex ink color
	isMatch: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomColor(): ColorEntry {
	return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateTrial(): Trial {
	const wordColor = randomColor();
	const isMatch = Math.random() < MATCH_PROBABILITY;

	if (isMatch) {
		return { word: wordColor.key, textColor: wordColor.hex, isMatch: true };
	}

	// Pick a different color for the ink
	let inkColor = randomColor();
	let attempts = 0;
	while (inkColor.key === wordColor.key && attempts < 10) {
		inkColor = randomColor();
		attempts++;
	}
	return { word: wordColor.key, textColor: inkColor.hex, isMatch: false };
}

// ── Phase type ────────────────────────────────────────────────────────────────
type Phase = "idle" | "playing" | "feedback";
type FeedbackKind = "correct" | "wrong" | "miss" | "skip";

const FEEDBACK_COLORS: Record<FeedbackKind, string> = {
	correct: "#43A047",
	wrong: "#E53935",
	miss: "#FB8C00",
	skip: "#43A047",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ColorClashGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBestScore = useGameStore(
		(s) => s.progress["color-clash"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();

	// ── State ──────────────────────────────────────────────────────────────────
	const [phase, setPhase] = useState<Phase>("idle");
	const [trial, setTrial] = useState<Trial | null>(null);
	const [round, setRound] = useState(0);
	const [scoreDisplay, setScoreDisplay] = useState(0);
	const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);
	const [finalScore, setFinalScore] = useState<number | null>(null);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);

	// Animated progress bar (1 → 0 over ROUND_MS)
	const progressAnim = useRef(new Animated.Value(1)).current;
	// Word pop-in on each new round
	const wordAnim = useRef(new Animated.Value(1)).current;
	// Feedback: pulse (scale) on correct, shake (translateX) on wrong/miss
	const feedbackPulseAnim = useRef(new Animated.Value(1)).current;
	const feedbackShakeAnim = useRef(new Animated.Value(0)).current;

	// ── Refs to avoid stale closures ───────────────────────────────────────────
	const roundRef = useRef(0);
	const scoreRef = useRef(0);
	const tappedRef = useRef(false);
	const phaseRef = useRef<Phase>("idle");
	const trialRef = useRef<Trial | null>(null);

	const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

	// Sync phaseRef with state
	const setPhaseSync = useCallback((p: Phase) => {
		phaseRef.current = p;
		setPhase(p);
	}, []);

	// ── Cleanup ────────────────────────────────────────────────────────────────
	useEffect(() => {
		return () => {
			if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
			if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
			if (progressAnimRef.current) progressAnimRef.current.stop();
		};
	}, []);

	// ── Show brief feedback flash ──────────────────────────────────────────────
	const showFeedback = useCallback(
		(kind: FeedbackKind, roundNum: number) => {
			if (progressAnimRef.current) progressAnimRef.current.stop();
			setPhaseSync("feedback");
			setFeedbackKind(kind);

			feedbackTimerRef.current = setTimeout(() => {
				const nextRound = roundNum + 1;
				if (nextRound >= TOTAL_ROUNDS) {
					// Game over
					const finalScoreVal = scoreRef.current;
					const info = updateProgress("color-clash", finalScoreVal);
					setProgressInfo(info);
					setFinalScore(finalScoreVal);
					setPhaseSync("idle");
					setTrial(null);
					trialRef.current = null;
					setFeedbackKind(null);
				} else {
					roundRef.current = nextRound;
					setRound(nextRound);
					// startRound will be called — but we need a stable ref; use inline
					// logic here to avoid circular dependency
					startRoundByNum(nextRound);
				}
			}, FEEDBACK_MS);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[setPhaseSync, updateProgress],
	);

	// ── Start a round ──────────────────────────────────────────────────────────
	const startRoundByNum = useCallback(
		(roundNum: number) => {
			if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
			if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
			if (progressAnimRef.current) progressAnimRef.current.stop();

			tappedRef.current = false;
			const newTrial = generateTrial();
			trialRef.current = newTrial;
			setTrial(newTrial);
			setFeedbackKind(null);
			setPhaseSync("playing");

			// Word pop-in
			wordAnim.setValue(0);
			Animated.spring(wordAnim, {
				toValue: 1,
				speed: 24,
				bounciness: 8,
				useNativeDriver: true,
			}).start();

			// Animate progress bar 1 → 0
			progressAnim.setValue(1);
			const anim = Animated.timing(progressAnim, {
				toValue: 0,
				duration: ROUND_MS,
				useNativeDriver: false,
			});
			progressAnimRef.current = anim;
			anim.start();

			// When time runs out
			roundTimerRef.current = setTimeout(() => {
				if (phaseRef.current !== "playing") return;

				const currentTrial = trialRef.current;
				if (!currentTrial) return;

				// Player didn't tap
				const isCorrectSkip = !currentTrial.isMatch;
				if (isCorrectSkip) {
					scoreRef.current += 1;
					setScoreDisplay(scoreRef.current);
					haptic.tap();
					showFeedback("skip", roundNum);
				} else {
					// missed a match
					showFeedback("miss", roundNum);
				}
			}, ROUND_MS);
		},
		[haptic, progressAnim, wordAnim, setPhaseSync, showFeedback],
	);

	// ── Feedback flash animation: pulse on correct/skip, shake on wrong/miss ──
	useEffect(() => {
		if (!feedbackKind) return;
		if (feedbackKind === "correct" || feedbackKind === "skip") {
			feedbackPulseAnim.setValue(1);
			Animated.sequence([
				Animated.timing(feedbackPulseAnim, {
					toValue: 1.12,
					duration: 100,
					useNativeDriver: true,
				}),
				Animated.timing(feedbackPulseAnim, {
					toValue: 1,
					duration: 130,
					useNativeDriver: true,
				}),
			]).start();
		} else {
			feedbackShakeAnim.setValue(0);
			Animated.sequence([
				Animated.timing(feedbackShakeAnim, {
					toValue: -8,
					duration: 50,
					useNativeDriver: true,
				}),
				Animated.timing(feedbackShakeAnim, {
					toValue: 8,
					duration: 60,
					useNativeDriver: true,
				}),
				Animated.timing(feedbackShakeAnim, {
					toValue: -4,
					duration: 50,
					useNativeDriver: true,
				}),
				Animated.timing(feedbackShakeAnim, {
					toValue: 0,
					duration: 40,
					useNativeDriver: true,
				}),
			]).start();
		}
	}, [feedbackKind, feedbackPulseAnim, feedbackShakeAnim]);

	// ── Handle player tap ──────────────────────────────────────────────────────
	const handleTap = () => {
		if (phaseRef.current === "idle") {
			// Start the game
			if (finalScore !== null) return; // result overlay shown — ignore
			scoreRef.current = 0;
			roundRef.current = 0;
			setScoreDisplay(0);
			setRound(0);
			setFinalScore(null);
			setProgressInfo(null);
			startRoundByNum(0);
			return;
		}

		if (phaseRef.current !== "playing") return;
		if (tappedRef.current) return;
		tappedRef.current = true;

		if (roundTimerRef.current) clearTimeout(roundTimerRef.current);

		const currentTrial = trialRef.current;
		if (!currentTrial) return;

		if (currentTrial.isMatch) {
			// Correct tap
			scoreRef.current += 1;
			setScoreDisplay(scoreRef.current);
			haptic.success();
			showFeedback("correct", roundRef.current);
		} else {
			// Wrong tap (mismatch)
			haptic.error();
			showFeedback("wrong", roundRef.current);
		}
	};

	// ── Reset / restart ────────────────────────────────────────────────────────
	const restart = () => {
		if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
		if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
		if (progressAnimRef.current) progressAnimRef.current.stop();
		progressAnim.setValue(1);

		tappedRef.current = false;
		scoreRef.current = 0;
		roundRef.current = 0;
		trialRef.current = null;
		setScoreDisplay(0);
		setRound(0);
		setTrial(null);
		setFeedbackKind(null);
		setFinalScore(null);
		setProgressInfo(null);
		setPhaseSync("idle");
	};

	// ── Derived UI values ──────────────────────────────────────────────────────
	const isIdle = phase === "idle";
	const isPlaying = phase === "playing" || phase === "feedback";

	const bgColor = (() => {
		if (feedbackKind) return FEEDBACK_COLORS[feedbackKind];
		if (isPlaying) return theme.card;
		return theme.elevated;
	})();

	// ── Render ─────────────────────────────────────────────────────────────────
	return (
		<View style={styles.root}>
			<GameControls onReset={restart} />

			{/* Score / round header */}
			{isPlaying && (
				<View style={styles.header}>
					<Text style={[styles.headerLabel, { color: theme.mutedText }]}>
						{t("colorClashScore")}
					</Text>
					<Text style={[styles.headerScore, { color: theme.text }]}>
						{scoreDisplay}
					</Text>
					<Text style={[styles.headerRound, { color: theme.mutedText }]}>
						{round + 1}/{TOTAL_ROUNDS}
					</Text>
				</View>
			)}

			{/* Progress bar */}
			{isPlaying && (
				<View
					style={[styles.progressTrack, { backgroundColor: theme.border }]}
				>
					<Animated.View
						style={[
							styles.progressFill,
							{
								backgroundColor: theme.tint,
								flex: progressAnim,
							},
						]}
					/>
				</View>
			)}

			{/* Main tap area */}
			<Pressable
				style={[styles.mainArea, { backgroundColor: bgColor }]}
				onPress={handleTap}
				accessibilityRole="button"
				accessibilityLabel={
					isIdle && finalScore === null
						? t("gameTapToStart")
						: trial
							? t(trial.word)
							: undefined
				}
			>
				{isIdle && finalScore === null ? (
					<>
						<Text style={[styles.startText, { color: theme.mutedText }]}>
							{t("gameTapToStart")}
						</Text>
						<Text style={[styles.hintText, { color: theme.mutedText }]}>
							{t("colorClashHint")}
						</Text>
					</>
				) : null}

				{(phase === "playing" || phase === "feedback") && trial ? (
					<Text
						style={[
							styles.wordText,
							{
								color: feedbackKind ? "#fff" : trial.textColor,
							},
						]}
					>
						{t(trial.word)}
					</Text>
				) : null}
			</Pressable>

			{/* Result overlay */}
			{finalScore !== null && (
				<GameResult
					title={t("gameColorClashName")}
					score={finalScore}
					best={progressInfo?.best ?? storedBestScore}
					last={
						progressInfo?.last !== undefined ? progressInfo.last : undefined
					}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					formatScore={(v) => `${v}/${TOTAL_ROUNDS}`}
					onPlayAgain={restart}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 12 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 4,
	},
	headerLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	headerScore: {
		fontSize: 28,
		fontWeight: "900",
		letterSpacing: -1,
	},
	headerRound: {
		fontSize: 14,
		fontWeight: "700",
	},
	progressTrack: {
		height: 6,
		borderRadius: 3,
		flexDirection: "row",
		overflow: "hidden",
	},
	progressFill: {
		height: 6,
	},
	mainArea: {
		flex: 1,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 240,
	},
	wordText: {
		fontSize: 52,
		fontWeight: "900",
		letterSpacing: 2,
		textTransform: "uppercase",
	},
	startText: {
		fontSize: 22,
		fontWeight: "900",
		letterSpacing: 2,
		textTransform: "uppercase",
		marginBottom: 12,
	},
	hintText: {
		fontSize: 14,
		fontWeight: "600",
		textAlign: "center",
		paddingHorizontal: 32,
	},
});
