import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";

const TOTAL_ROUNDS = 5;
const WAIT_MIN_MS = 1200;
const WAIT_MAX_MS = 4200;
const REACTION_SCORE_BASE = 1000;

type Phase = "idle" | "waiting" | "ready";

/** Wait window shrinks as rounds progress, making it less predictable */
function randomWaitMs(roundNum: number) {
	const shrink = Math.min(800, (roundNum - 1) * 200);
	const min = WAIT_MIN_MS;
	const max = Math.max(min + 400, WAIT_MAX_MS - shrink);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function encodeReactionScore(bestMs: number) {
	return Math.max(0, REACTION_SCORE_BASE - bestMs);
}

function decodeReactionScore(score: number) {
	return Math.max(0, REACTION_SCORE_BASE - score);
}

/** Extracted so useFadeIn re-runs on every mount of the banner */
function TooEarlyBanner({
	theme,
	title,
	message,
}: {
	theme: (typeof Colors)[keyof typeof Colors];
	title: string;
	message: string;
}) {
	const fadeIn = useFadeIn(0, 200);
	return (
		<Animated.View
			style={[
				styles.tooEarlyBanner,
				{ backgroundColor: theme.card, borderColor: "#cc4b5a" },
				fadeIn,
			]}
		>
			<Text style={[styles.tooEarlyTitle, { color: "#cc4b5a" }]}>{title}</Text>
			<Text style={[styles.tooEarlyMsg, { color: theme.mutedText }]}>
				{message}
			</Text>
		</Animated.View>
	);
}

export default function ReactionGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBestScore = useGameStore(
		(s) => s.progress["reaction"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("idle");
	const [bestMs, setBestMs] = useState<number | null>(null);
	const [lastMs, setLastMs] = useState<number | null>(null);
	const [round, setRound] = useState(0);
	const [results, setResults] = useState<number[]>([]);
	const [finalScore, setFinalScore] = useState<number | null>(null);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);
	const [tooEarly, setTooEarly] = useState(false);
	const tooEarlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startedAtRef = useRef<number | null>(null);
	const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const padScale = useSharedValue(1);
	const lastStatScale = useSharedValue(1);

	const padAnimStyle = useAnimatedStyle(() => ({
		transform: [{ scale: padScale.value }],
	}));
	const lastStatAnimStyle = useAnimatedStyle(() => ({
		transform: [{ scale: lastStatScale.value }],
	}));

	// Quick pulse when the pad turns "go"
	useEffect(() => {
		if (phase !== "ready") return;
		padScale.value = withSequence(
			withTiming(1.03, { duration: 90, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
		);
	}, [phase, padScale]);

	// Pop the "last" reaction time when a new result lands
	useEffect(() => {
		if (lastMs === null) return;
		lastStatScale.value = withSequence(
			withTiming(1.15, { duration: 90, easing: Easing.out(Easing.quad) }),
			withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
		);
	}, [lastMs, lastStatScale]);

	useEffect(() => {
		return () => {
			if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
			if (tooEarlyTimer.current) clearTimeout(tooEarlyTimer.current);
		};
	}, []);

	const startRound = () => {
		if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
		if (round === 0) {
			setBestMs(null);
			setLastMs(null);
		}
		setFinalScore(null);
		const nextRound = round + 1;
		setRound(nextRound);
		setPhase("waiting");
		startedAtRef.current = null;

		waitTimerRef.current = setTimeout(() => {
			startedAtRef.current = Date.now();
			setPhase("ready");
		}, randomWaitMs(nextRound));
	};

	const handleMainPress = () => {
		if (phase === "idle") {
			startRound();
			return;
		}

		if (phase === "waiting") {
			if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
			setPhase("idle");
			setRound(0);
			setResults([]);
			setBestMs(null);
			setLastMs(null);
			haptic.error();
			setTooEarly(true);
			if (tooEarlyTimer.current) clearTimeout(tooEarlyTimer.current);
			tooEarlyTimer.current = setTimeout(() => setTooEarly(false), 1500);
			return;
		}

		if (phase === "ready") {
			const now = Date.now();
			const ms = Math.max(0, now - (startedAtRef.current ?? now));
			haptic.success();
			setLastMs(ms);
			setBestMs((prev) => (prev === null ? ms : Math.min(prev, ms)));
			const newResults = [...results, ms];
			setResults(newResults);

			if (newResults.length >= TOTAL_ROUNDS) {
				const runBestMs = Math.min(...newResults);
				const score = encodeReactionScore(runBestMs);
				const info = updateProgress("reaction", score);
				setProgressInfo(info);
				setFinalScore(runBestMs);
				setPhase("idle");
				setRound(0);
				setResults([]);
			} else {
				// Auto-start next round after brief pause
				setPhase("idle");
				setTimeout(() => startRound(), 600);
			}
		}
	};

	const restart = () => {
		if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
		setPhase("idle");
		setRound(0);
		setResults([]);
		setBestMs(null);
		setLastMs(null);
		setFinalScore(null);
		setProgressInfo(null);
		setTooEarly(false);
	};

	const padColor =
		phase === "ready"
			? "#2e9f5b"
			: phase === "waiting"
				? theme.warning
				: theme.elevated;

	const padLabel =
		phase === "idle"
			? t("reactionTapToStart")
			: phase === "waiting"
				? t("reactionWait")
				: t("reactionTap");

	const padTextColor = phase === "idle" ? theme.mutedText : "#fff";

	return (
		<View style={styles.root}>
			{/* ── Header controls ── */}
			<GameControls onReset={restart} />

			{/* ── Stats ── */}
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("reactionLast")}
					</Text>
					<Animated.View style={lastStatAnimStyle}>
						<Text style={[styles.statValue, { color: theme.text }]}>
							{lastMs === null ? "—" : `${lastMs}`}
						</Text>
					</Animated.View>
					{lastMs !== null ? (
						<Text style={[styles.statUnit, { color: theme.mutedText }]}>
							{t("reactionMs")}
						</Text>
					) : null}
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("reactionBest")}
					</Text>
					<Text
						style={[
							styles.statValue,
							{ color: bestMs !== null ? theme.tint : theme.text },
						]}
					>
						{bestMs === null ? "—" : `${bestMs}`}
					</Text>
					{bestMs !== null ? (
						<Text style={[styles.statUnit, { color: theme.mutedText }]}>
							{t("reactionMs")}
						</Text>
					) : null}
				</View>
			</View>

			{/* ── Too early banner ── */}
			{tooEarly && (
				<TooEarlyBanner
					theme={theme}
					title={t("reactionTooEarlyTitle")}
					message={t("reactionTooEarlyMsg")}
				/>
			)}

			{/* ── Main pad ── */}
			<Animated.View style={[styles.padWrap, padAnimStyle]}>
				<Pressable
					style={[styles.pad, { backgroundColor: padColor }]}
					onPress={handleMainPress}
				>
					<Text style={[styles.padText, { color: padTextColor }]}>
						{padLabel}
					</Text>
					{round > 0 && (
						<Text style={[styles.roundHint, { color: padTextColor }]}>
							{round}/{TOTAL_ROUNDS}
						</Text>
					)}
				</Pressable>
			</Animated.View>

			{finalScore !== null && (
				<GameResult
					title={t("gameReactionName")}
					score={finalScore}
					best={decodeReactionScore(progressInfo?.best ?? storedBestScore)}
					last={
						progressInfo?.last
							? decodeReactionScore(progressInfo.last)
							: undefined
					}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					formatScore={(value) => `${value} ${t("reactionMs")}`}
					onPlayAgain={restart}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
	/* ── Stats ── */
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
	statUnit: { fontSize: 13, fontWeight: "600", marginTop: -4 },
	statDivider: { width: 1, height: 56 },
	/* ── Pad ── */
	padWrap: { flex: 1 },
	pad: {
		flex: 1,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 240,
	},
	padText: { fontSize: 30, fontWeight: "900", letterSpacing: 2 },
	roundHint: { fontSize: 14, fontWeight: "700", marginTop: 8, opacity: 0.8 },
	/* ── Too early ── */
	tooEarlyBanner: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingVertical: 12,
		paddingHorizontal: 16,
		alignItems: "center",
		gap: 4,
	},
	tooEarlyTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
	tooEarlyMsg: { fontSize: 13, fontWeight: "600" },
});
