import { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

const ROUNDS = 10;
const { width: SCREEN_W } = Dimensions.get("window");
const DIE_SIZE = SCREEN_W * 0.52;
const PIP_SIZE = DIE_SIZE * 0.14;
const DIE_RADIUS = DIE_SIZE * 0.16;
const MAX_PLAYERS = 6;

const PLAYER_COLORS = [
	"#4FC3F7",
	"#FF8A65",
	"#81C784",
	"#CE93D8",
	"#FFD54F",
	"#4DD0E1",
];

const FACE_PIPS: Record<number, number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};

const PIP_KEYS = [
	"p0",
	"p1",
	"p2",
	"p3",
	"p4",
	"p5",
	"p6",
	"p7",
	"p8",
] as const;

type DiceStanding = {
	playerIndex: number;
	wins: number;
	total: number;
};

function rollDie(): number {
	return Math.floor(Math.random() * 6) + 1;
}

export default function DuelDiceGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [playerCount, setPlayerCount] = useState(2);
	const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");

	const [round, setRound] = useState(1);
	const [activePlayer, setActivePlayer] = useState(0);
	const [totals, setTotals] = useState<number[]>([]);
	const [roundWins, setRoundWins] = useState<number[]>([]);
	const [currentRolls, setCurrentRolls] = useState<(number | null)[]>([]);
	const [rollingValue, setRollingValue] = useState<number | null>(null);
	const [isRolling, setIsRolling] = useState(false);
	const [roundResult, setRoundResult] = useState<string | null>(null);

	const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const roundTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
			if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
			if (roundTransitionRef.current) clearTimeout(roundTransitionRef.current);
		};
	}, []);

	const startGame = () => {
		const zeros = Array(playerCount).fill(0) as number[];
		setTotals(zeros);
		setRoundWins([...zeros]);
		setCurrentRolls(Array(playerCount).fill(null));
		setRound(1);
		setActivePlayer(0);
		setRollingValue(null);
		setIsRolling(false);
		setRoundResult(null);
		setPhase("playing");
	};

	const finalizeRoll = (finalRoll: number) => {
		setRollingValue(finalRoll);
		setIsRolling(false);

		const pIdx = activePlayer;
		setTotals((prev) => {
			const next = [...prev];
			next[pIdx] += finalRoll;
			return next;
		});

		const newRolls = [...currentRolls];
		newRolls[pIdx] = finalRoll;
		setCurrentRolls(newRolls);

		if (!newRolls.every((r) => r !== null)) {
			setActivePlayer(pIdx + 1);
			return;
		}

		const rolls = newRolls as number[];
		const maxRoll = Math.max(...rolls);
		const winners = rolls
			.map((r, i) => (r === maxRoll ? i : -1))
			.filter((i) => i >= 0);

		let resultText: string;
		if (winners.length >= playerCount) {
			resultText = t("diceRoundDraw");
		} else if (winners.length === 1) {
			resultText = t("dicePlayerWinsRound", { player: String(winners[0] + 1) });
			setRoundWins((prev) => {
				const next = [...prev];
				next[winners[0]]++;
				return next;
			});
		} else {
			resultText = t("diceRoundDraw");
		}

		setRoundResult(resultText);

		const nextRound = round + 1;
		if (nextRound > ROUNDS) {
			const updatedTotals = [...totals];
			updatedTotals[pIdx] += finalRoll;
			updateProgress("duel-dice", Math.max(...updatedTotals));

			roundTransitionRef.current = setTimeout(() => {
				setPhase("done");
				roundTransitionRef.current = null;
			}, 1800);
		} else {
			roundTransitionRef.current = setTimeout(() => {
				setRound(nextRound);
				setActivePlayer(0);
				setCurrentRolls(Array(playerCount).fill(null));
				setRoundResult(null);
				roundTransitionRef.current = null;
			}, 1800);
		}
	};

	const handleRoll = () => {
		if (phase !== "playing" || isRolling || roundResult !== null) return;
		haptic.tap();
		setIsRolling(true);
		setRollingValue(rollDie());
		rollingIntervalRef.current = setInterval(
			() => setRollingValue(rollDie()),
			90,
		);
		settleTimeoutRef.current = setTimeout(() => {
			if (rollingIntervalRef.current) {
				clearInterval(rollingIntervalRef.current);
				rollingIntervalRef.current = null;
			}
			finalizeRoll(rollDie());
		}, 1100);
	};

	const visiblePips =
		rollingValue && FACE_PIPS[rollingValue] ? FACE_PIPS[rollingValue] : [];
	const canRoll = phase === "playing" && !isRolling && roundResult === null;
	const activeColor = PLAYER_COLORS[activePlayer % PLAYER_COLORS.length];

	const getStandings = (): DiceStanding[] =>
		totals
			.map((total, playerIndex) => ({
				playerIndex,
				wins: roundWins[playerIndex] ?? 0,
				total,
			}))
			.sort((a, b) => {
				if (a.wins !== b.wins) return b.wins - a.wins;
				if (a.total !== b.total) return b.total - a.total;
				return a.playerIndex - b.playerIndex;
			});

	const getWinner = (): string => {
		const maxWins = Math.max(...roundWins);
		const topByWins = roundWins
			.map((w, i) => (w === maxWins ? i : -1))
			.filter((i) => i >= 0);
		if (topByWins.length === 1)
			return t("dicePlayerWins", { player: String(topByWins[0] + 1) });
		const maxTotal = Math.max(...topByWins.map((i) => totals[i]));
		const topByTotal = topByWins.filter((i) => totals[i] === maxTotal);
		if (topByTotal.length === 1)
			return t("dicePlayerWins", { player: String(topByTotal[0] + 1) });
		return t("diceDraw");
	};

	/* SETUP */
	if (phase === "setup") {
		return (
			<View style={styles.root}>
				<Text style={[styles.title, { color: theme.text }]}>
					{t("gameDuelDiceName")}
				</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("mpSelectPlayers")}
				</Text>
				<View style={styles.countRow}>
					{Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map((n) => (
						<Pressable
							key={n}
							style={[
								styles.countBtn,
								{
									backgroundColor: playerCount === n ? theme.tint : theme.card,
									borderColor: playerCount === n ? theme.tint : theme.border,
								},
							]}
							onPress={() => setPlayerCount(n)}
						>
							<Text
								style={[
									styles.countBtnText,
									{ color: playerCount === n ? "#fff" : theme.text },
								]}
							>
								{n}
							</Text>
						</Pressable>
					))}
				</View>
				<Pressable
					style={[styles.startBtn, { backgroundColor: theme.tint }]}
					onPress={startGame}
				>
					<Text style={styles.startBtnText}>{t("start")}</Text>
				</Pressable>
			</View>
		);
	}

	/* DONE */
	if (phase === "done") {
		const standings = getStandings();

		return (
			<ScrollView
				style={styles.resultScroll}
				contentContainerStyle={styles.resultContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={[styles.winnerText, { color: theme.text }]}>
					{getWinner()}
				</Text>
				<Text style={[styles.resultSubtitle, { color: theme.mutedText }]}>
					{t("diceGameOver")}
				</Text>
				<View style={styles.finalTable}>
					{standings.map((standing, rank) => (
						<View
							key={standing.playerIndex}
							style={[
								styles.finalRow,
								{
									backgroundColor:
										rank === 0
											? `${PLAYER_COLORS[standing.playerIndex]}18`
											: theme.card,
									borderColor:
										rank === 0
											? PLAYER_COLORS[standing.playerIndex]
											: theme.border,
								},
							]}
						>
							<Text style={[styles.finalRank, { color: theme.mutedText }]}>
								#{rank + 1}
							</Text>
							<View
								style={styles.finalPlayer}
								lightColor="transparent"
								darkColor="transparent"
							>
								<View
									style={[
										styles.playerDot,
										{ backgroundColor: PLAYER_COLORS[standing.playerIndex] },
									]}
								/>
								<Text style={[styles.finalName, { color: theme.text }]}>
									{t("mpPlayerN", { n: standing.playerIndex + 1 })}
								</Text>
							</View>
							<View
								style={styles.finalMetric}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Text style={[styles.finalMetricValue, { color: theme.text }]}>
									{standing.wins}
								</Text>
								<Text
									style={[styles.finalMetricLabel, { color: theme.mutedText }]}
								>
									{t("diceWinsLabel")}
								</Text>
							</View>
							<View
								style={styles.finalMetric}
								lightColor="transparent"
								darkColor="transparent"
							>
								<Text style={[styles.finalMetricValue, { color: theme.tint }]}>
									{standing.total}
								</Text>
								<Text
									style={[styles.finalMetricLabel, { color: theme.mutedText }]}
								>
									{t("dicePtsLabel")}
								</Text>
							</View>
						</View>
					))}
				</View>
				<Pressable
					style={[styles.startBtn, { backgroundColor: theme.tint }]}
					onPress={() => setPhase("setup")}
				>
					<Text style={styles.startBtnText}>{t("playAgain")}</Text>
				</Pressable>
			</ScrollView>
		);
	}

	/* PLAYING */
	return (
		<View style={styles.root}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.scoreScroll}
				contentContainerStyle={styles.scoreContainer}
			>
				{Array.from({ length: playerCount }, (_, i) => {
					const isActive = i === activePlayer;
					const rolled = currentRolls[i];
					const playerColor = PLAYER_COLORS[i];
					return (
						<View
							key={`player-${i + 1}`}
							style={[
								styles.scoreCard,
								{
									borderColor: isActive ? playerColor : theme.border + "44",
									backgroundColor: isActive ? playerColor + "16" : theme.card,
								},
							]}
						>
							<View style={styles.scoreCardHeader}>
								<View
									style={[styles.playerDot, { backgroundColor: playerColor }]}
								/>
								<Text
									style={[
										styles.scoreCardName,
										{ color: isActive ? playerColor : theme.mutedText },
									]}
								>
									P{i + 1}
								</Text>
							</View>
							<View
								style={[
									styles.rollBadge,
									{
										backgroundColor:
											rolled !== null ? playerColor + "20" : theme.surface,
										borderColor:
											rolled !== null || isActive ? playerColor : theme.border,
									},
								]}
							>
								<Text
									style={[
										styles.rollBadgeText,
										{
											color:
												rolled !== null || isActive
													? playerColor
													: theme.mutedText,
										},
									]}
								>
									{rolled ?? "-"}
								</Text>
							</View>
							<Text style={[styles.scoreCardMeta, { color: theme.mutedText }]}>
								{roundWins[i]} {t("diceWinsLabel")} · {totals[i]}{" "}
								{t("dicePtsLabel")}
							</Text>
						</View>
					);
				})}
			</ScrollView>

			<View style={styles.dieArea}>
				<View
					style={[
						styles.dieFace,
						{
							borderColor: isRolling ? activeColor : theme.border,
							backgroundColor: theme.elevated,
						},
					]}
				>
					{Array.from({ length: 9 }).map((_, i) => (
						<View key={PIP_KEYS[i]} style={styles.pipCell}>
							{visiblePips.includes(i) ? (
								<View
									style={[
										styles.pip,
										{ backgroundColor: isRolling ? activeColor : theme.text },
									]}
								/>
							) : null}
						</View>
					))}
				</View>
				<Text
					style={[
						styles.roundLabel,
						{ color: roundResult ? theme.tint : theme.mutedText },
					]}
				>
					{roundResult ??
						t("diceRoundOf", { round: Math.min(round, ROUNDS), total: ROUNDS })}
				</Text>
			</View>

			<Pressable
				style={[
					styles.rollBtn,
					{
						backgroundColor: canRoll ? activeColor : theme.card,
						borderColor: canRoll ? activeColor : theme.border,
					},
				]}
				onPress={handleRoll}
			>
				<Text
					style={[
						styles.rollBtnText,
						{ color: canRoll ? "#fff" : theme.mutedText },
					]}
				>
					{canRoll
						? `${t("mpPlayerN", { n: activePlayer + 1 })} \u2014 ${t("diceTapToRoll")}`
						: isRolling
							? `${t("mpPlayerN", { n: activePlayer + 1 })}\u2026`
							: t("diceWaiting")}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		paddingHorizontal: 12,
		paddingVertical: 8,
		justifyContent: "center",
		alignItems: "center",
	},
	title: { fontSize: 28, fontWeight: "900", marginBottom: 8 },
	subtitle: { fontSize: 16, fontWeight: "600", marginBottom: 16 },
	countRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
	countBtn: {
		width: 48,
		height: 48,
		borderRadius: 12,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	countBtnText: { fontSize: 20, fontWeight: "800" },
	startBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12 },
	startBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
	resultScroll: { flex: 1, width: "100%" },
	resultContent: {
		flexGrow: 1,
		paddingHorizontal: 12,
		paddingVertical: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	winnerText: {
		fontSize: 28,
		fontWeight: "900",
		marginBottom: 4,
		textAlign: "center",
	},
	resultSubtitle: { fontSize: 13, fontWeight: "700", marginBottom: 14 },
	finalTable: { width: "100%", gap: 8, marginBottom: 20 },
	finalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 10,
		paddingHorizontal: 10,
		borderRadius: 14,
		borderWidth: 1.5,
	},
	finalRank: {
		width: 28,
		fontSize: 13,
		fontWeight: "900",
		textAlign: "center",
	},
	finalPlayer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
	finalName: { fontSize: 15, fontWeight: "800", flexShrink: 1 },
	finalMetric: { width: 54, alignItems: "flex-end" },
	finalMetricValue: { fontSize: 16, fontWeight: "900" },
	finalMetricLabel: { fontSize: 10, fontWeight: "700" },
	scoreScroll: { maxHeight: 86, flexGrow: 0 },
	scoreContainer: { gap: 8, paddingHorizontal: 4, alignItems: "stretch" },
	scoreCard: {
		alignItems: "stretch",
		paddingVertical: 8,
		paddingHorizontal: 9,
		borderRadius: 10,
		borderWidth: 1.5,
		minWidth: 86,
		gap: 5,
	},
	playerDot: { width: 10, height: 10, borderRadius: 5 },
	scoreCardHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
	scoreCardName: { fontSize: 11, fontWeight: "900" },
	rollBadge: {
		minHeight: 28,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	rollBadgeText: { fontSize: 18, fontWeight: "900" },
	scoreCardMeta: { fontSize: 10, fontWeight: "700", textAlign: "center" },
	dieArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
	dieFace: {
		width: DIE_SIZE,
		height: DIE_SIZE,
		borderRadius: DIE_RADIUS,
		borderWidth: 2,
		padding: DIE_SIZE * 0.1,
		flexDirection: "row",
		flexWrap: "wrap",
	},
	pipCell: {
		width: "33.33%",
		height: "33.33%",
		alignItems: "center",
		justifyContent: "center",
	},
	pip: { width: PIP_SIZE, height: PIP_SIZE, borderRadius: 999 },
	roundLabel: { fontSize: 14, fontWeight: "600" },
	rollBtn: {
		borderRadius: 16,
		borderWidth: 1.5,
		paddingVertical: 22,
		alignItems: "center",
		justifyContent: "center",
		width: "100%",
		marginBottom: 8,
	},
	rollBtnText: {
		fontSize: 18,
		fontWeight: "800",
		letterSpacing: 1.2,
		textTransform: "uppercase",
	},
});
