import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";
import GameResult from "@/components/GameResult";

const ROUND_COUNT = 5;
const RUNWAY_WIDTH = 280;
const BASE_TARGET_WIDTH = 72;
const BASE_SPEED = 8;

/** Target zone shrinks slightly each round */
function getTargetWidth(round: number) {
	return Math.max(40, BASE_TARGET_WIDTH - (round - 1) * 5);
}

/** Marker speed increases each round */
function getSpeed(round: number) {
	return BASE_SPEED + (round - 1) * 1.5;
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
	const [lastPoints, setLastPoints] = useState<number | null>(null);
	const [lastQuality, setLastQuality] = useState<Quality | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const speed = getSpeed(round);

	useEffect(() => {
		if (finished) return;
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
	}, [direction, speed, finished]);

	const currentRoundText = useMemo(() => `${round}/${ROUND_COUNT}`, [round]);

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
		setRound(1);
		setScore(0);
		setMarkerX(0);
		setDirection(1);
		setTargetLeft(getTargetLeft(BASE_TARGET_WIDTH));
		setFinished(false);
		setLastPoints(null);
		setLastQuality(null);
	};

	const handleLand = () => {
		if (finished) return;

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

		setScore(nextScore);
		setLastPoints(points);
		setLastQuality(quality);

		// Clear previous timer
		if (feedbackTimer.current) clearTimeout(feedbackTimer.current);

		if (nextRound > ROUND_COUNT) {
			setFinished(true);
			updateProgress("runway-landing", nextScore);
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

			<View
				style={[
					styles.runwayCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				{/* Quality feedback or hint */}
				{lastQuality ? (
					<Text
						style={[
							styles.qualityText,
							{ color: getQualityColor(lastQuality) },
						]}
					>
						{qualityKey(lastQuality)}{" "}
						<Text style={styles.qualityPoints}>+{lastPoints}</Text>
					</Text>
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
					{"▸".repeat(Math.min(round, 5))}
				</Text>
			</View>

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
			>
				<Text style={styles.buttonText}>{t("rlLand")}</Text>
			</Pressable>

			{finished && (
				<GameResult
					title={t("rlFinished")}
					score={score}
					subtitle={t("rlResult", {
						correct: ROUND_COUNT,
						total: ROUND_COUNT,
					})}
					onPlayAgain={restart}
				/>
			)}
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
		color: "#fff",
		fontSize: 20,
		fontWeight: "900",
		letterSpacing: 1,
	},
});
