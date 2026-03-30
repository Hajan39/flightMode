import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";

const ROUND_COUNT = 5;
const RUNWAY_WIDTH = 280;
const TARGET_WIDTH = 72;

function getTargetLeft() {
	return 24 + Math.random() * (RUNWAY_WIDTH - TARGET_WIDTH - 48);
}

export default function RunwayLandingGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const [round, setRound] = useState(1);
	const [score, setScore] = useState(0);
	const [markerX, setMarkerX] = useState(0);
	const [direction, setDirection] = useState(1);
	const [targetLeft, setTargetLeft] = useState(getTargetLeft);
	const [finished, setFinished] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		intervalRef.current = setInterval(() => {
			setMarkerX((prev) => {
				const next = prev + direction * 8;
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
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [direction]);

	const currentRoundText = useMemo(() => `${round}/${ROUND_COUNT}`, [round]);

	const restart = () => {
		setRound(1);
		setScore(0);
		setMarkerX(0);
		setDirection(1);
		setTargetLeft(getTargetLeft());
		setFinished(false);
	};

	const handleLand = () => {
		if (finished) {
			restart();
			return;
		}

		const center = markerX + 6;
		const targetCenter = targetLeft + TARGET_WIDTH / 2;
		const dist = Math.abs(center - targetCenter);
		const points = Math.max(0, 100 - Math.round(dist * 1.2));
		const nextScore = score + points;
		const nextRound = round + 1;

		setScore(nextScore);

		if (nextRound > ROUND_COUNT) {
			setFinished(true);
			updateProgress("runway-landing", nextScore);
			return;
		}

		setRound(nextRound);
		setTargetLeft(getTargetLeft());
	};

	return (
		<View style={styles.root}>
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>{t("rlRound")}</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{currentRoundText}
					</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>{t("rlScore")}</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</View>
			</View>

			<View
				style={[
					styles.runwayCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.helper, { color: theme.mutedText }]}>{t("rlTapHint")}</Text>
				<View style={[styles.runway, { backgroundColor: theme.elevated }]}> 
					<View
						style={[
							styles.targetZone,
							{ left: targetLeft, width: TARGET_WIDTH, backgroundColor: theme.accentSoft, borderColor: theme.tint },
						]}
					/>
					<View style={[styles.marker, { left: markerX, backgroundColor: theme.tint }]} />
				</View>
			</View>

			<Pressable
				style={[styles.button, { backgroundColor: theme.tint }]}
				onPress={handleLand}
			>
				<Text style={styles.buttonText}>{finished ? t("rlRestart") : t("rlLand")}</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
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
	buttonText: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
});
