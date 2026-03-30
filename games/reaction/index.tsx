import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";

const WAIT_MIN_MS = 1200;
const WAIT_MAX_MS = 4200;

type Phase = "idle" | "waiting" | "ready";

function randomWaitMs() {
	return (
		Math.floor(Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS + 1)) + WAIT_MIN_MS
	);
}

export default function ReactionGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const [phase, setPhase] = useState<Phase>("idle");
	const [bestMs, setBestMs] = useState<number | null>(null);
	const [lastMs, setLastMs] = useState<number | null>(null);
	const startedAtRef = useRef<number | null>(null);
	const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
		};
	}, []);

	const startRound = () => {
		if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
		setPhase("waiting");
		startedAtRef.current = null;

		waitTimerRef.current = setTimeout(() => {
			startedAtRef.current = Date.now();
			setPhase("ready");
		}, randomWaitMs());
	};

	const handleMainPress = () => {
		if (phase === "idle") {
			startRound();
			return;
		}

		if (phase === "waiting") {
			if (waitTimerRef.current) clearTimeout(waitTimerRef.current);
			setPhase("idle");
			Alert.alert(t("reactionTooEarlyTitle"), t("reactionTooEarlyMsg"));
			return;
		}

		if (phase === "ready") {
			const now = Date.now();
			const ms = Math.max(0, now - (startedAtRef.current ?? now));
			setLastMs(ms);
			setBestMs((prev) => (prev === null ? ms : Math.min(prev, ms)));
			updateProgress("reaction", Math.max(0, 1000 - ms));
			setPhase("idle");
		}
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

			{/* ── Main pad ── */}
			<Pressable
				style={[styles.pad, { backgroundColor: padColor }]}
				onPress={handleMainPress}
			>
				<Text style={[styles.padText, { color: padTextColor }]}>
					{padLabel}
				</Text>
			</Pressable>
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
});
