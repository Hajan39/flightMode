import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

const TOTAL_ROUNDS = 5;
const WAIT_MIN_MS = 1200;
const WAIT_MAX_MS = 4200;

type Phase = "idle" | "waiting" | "ready";

/** Wait window shrinks as rounds progress, making it less predictable */
function randomWaitMs(roundNum: number) {
	const shrink = Math.min(800, (roundNum - 1) * 200);
	const min = WAIT_MIN_MS;
	const max = Math.max(min + 400, WAIT_MAX_MS - shrink);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function ReactionGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("idle");
	const [bestMs, setBestMs] = useState<number | null>(null);
	const [lastMs, setLastMs] = useState<number | null>(null);
	const [round, setRound] = useState(0);
	const [results, setResults] = useState<number[]>([]);
	const [finalScore, setFinalScore] = useState<number | null>(null);
	const [tooEarly, setTooEarly] = useState(false);
	const tooEarlyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startedAtRef = useRef<number | null>(null);
	const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
			if (tooEarlyTimer.current) clearTimeout(tooEarlyTimer.current);
		};
	}, []);

	const startRound = () => {
		if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
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
				const avg = Math.round(
					newResults.reduce((a, b) => a + b, 0) / newResults.length,
				);
				const score = Math.max(0, 1000 - avg);
				updateProgress("reaction", score);
				setFinalScore(score);
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
		setLastMs(null);
		setFinalScore(null);
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
			{/* ── Stats ── */}
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("reactionLast")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{lastMs === null ? "—" : `${lastMs}`}
					</Text>
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
				<View
					style={[
						styles.tooEarlyBanner,
						{ backgroundColor: theme.card, borderColor: "#cc4b5a" },
					]}
				>
					<Text style={[styles.tooEarlyTitle, { color: "#cc4b5a" }]}>
						{t("reactionTooEarlyTitle")}
					</Text>
					<Text style={[styles.tooEarlyMsg, { color: theme.mutedText }]}>
						{t("reactionTooEarlyMsg")}
					</Text>
				</View>
			)}

			{/* ── Main pad ── */}
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

			{finalScore !== null && (
				<GameResult
					title={t("gameReactionName")}
					score={finalScore}
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
