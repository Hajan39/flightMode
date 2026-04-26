import { useEffect, useRef, useState } from "react";
import {
	Dimensions,
	Pressable,
	ScrollView,
	StyleSheet,
	View as RNView,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const { width: SCREEN_W } = Dimensions.get("window");

const GRID_COLS = 5;
const GRID_ROWS = 6;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const CELL_GAP = 6;
const CELL_SIZE = Math.floor(
	(SCREEN_W - 32 - CELL_GAP * (GRID_COLS - 1)) / GRID_COLS,
);
const BASE_ROUND_TIME = 30;
const ROUNDS = 5;
const MAX_PLAYERS = 6;

const PLAYER_COLORS = [
	"#ef5350",
	"#ffd54f",
	"#4FC3F7",
	"#81C784",
	"#CE93D8",
	"#FF8A65",
];

function getRoundTime(round: number): number {
	return Math.max(15, BASE_ROUND_TIME - (round - 1) * 3);
}

const EMOJI_POOL = [
	"\u2708\uFE0F",
	"\uD83D\uDEEB",
	"\uD83D\uDEEC",
	"\uD83D\uDE81",
	"\uD83D\uDEE9\uFE0F",
	"\uD83E\uDE82",
	"\uD83C\uDF92",
	"\uD83E\uDDF3",
	"\uD83D\uDDFA\uFE0F",
	"\uD83C\uDF0D",
	"\u26C5",
	"\uD83C\uDF24\uFE0F",
	"\u2601\uFE0F",
	"\uD83C\uDF08",
	"\u2B50",
	"\uD83C\uDF19",
	"\uD83D\uDD2D",
	"\uD83E\uDDED",
	"\u26A1",
	"\uD83C\uDF0A",
	"\uD83C\uDFD4\uFE0F",
	"\uD83C\uDFDD\uFE0F",
	"\uD83D\uDDFC",
	"\uD83D\uDDFD",
	"\uD83C\uDFA1",
	"\uD83C\uDFF0",
	"\u26E9\uFE0F",
	"\uD83D\uDD4C",
	"\uD83C\uDF8C",
	"\uD83D\uDEA2",
	"\uD83D\uDE80",
	"\uD83D\uDEF8",
	"\uD83C\uDFAF",
	"\uD83C\uDFAA",
	"\uD83C\uDFA0",
	"\uD83C\uDFA2",
	"\uD83D\uDE82",
	"\uD83D\uDEA4",
	"\u26F5",
	"\uD83C\uDFD6\uFE0F",
	"\uD83C\uDF34",
	"\uD83C\uDF3A",
	"\uD83E\uDD85",
	"\uD83E\uDD9C",
	"\uD83D\uDC2C",
	"\uD83E\uDD8B",
	"\uD83C\uDF3B",
	"\uD83C\uDF40",
	"\uD83D\uDC8E",
	"\uD83D\uDD11",
];

function shuffleArray<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

function generateRound(): { grid: string[]; target: string } {
	const picked = shuffleArray(EMOJI_POOL).slice(0, TOTAL_CELLS);
	const grid = shuffleArray(picked);
	const target = grid[Math.floor(Math.random() * grid.length)];
	return { grid, target };
}

export default function DuelEmojiFindGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	/* setup */
	const [playerCount, setPlayerCount] = useState(2);
	const [phase, setPhase] = useState<
		"setup" | "handoff" | "playing" | "roundEnd" | "finished"
	>("setup");

	/* game */
	const [round, setRound] = useState(1);
	const [currentPlayer, setCurrentPlayer] = useState(0);
	const [scores, setScores] = useState<number[]>([]);
	const [roundScores, setRoundScores] = useState<number[]>([]);
	const [grid, setGrid] = useState<string[]>([]);
	const [target, setTarget] = useState("");
	const [timeLeft, setTimeLeft] = useState(BASE_ROUND_TIME);
	const [turnScore, setTurnScore] = useState(0);
	const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startGame = () => {
		setScores(Array(playerCount).fill(0));
		setRoundScores(Array(playerCount).fill(0));
		setRound(1);
		setCurrentPlayer(0);
		setPhase("handoff");
	};

	const startTurn = () => {
		const { grid: g, target: tgt } = generateRound();
		setGrid(g);
		setTarget(tgt);
		setTimeLeft(getRoundTime(round));
		setTurnScore(0);
		setFoundCells(new Set());
		setPhase("playing");
	};

	useEffect(() => {
		if (phase !== "playing") return;
		timerRef.current = setInterval(() => {
			setTimeLeft((prev) => {
				if (prev <= 1) {
					if (timerRef.current) clearInterval(timerRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [phase]);

	/* when time runs out */
	useEffect(() => {
		if (phase !== "playing" || timeLeft > 0) return;
		endTurn();
	}, [timeLeft, phase]);

	const endTurn = () => {
		if (timerRef.current) clearInterval(timerRef.current);
		const newRoundScores = [...roundScores];
		newRoundScores[currentPlayer] = turnScore;
		setRoundScores(newRoundScores);

		const nextPlayer = currentPlayer + 1;
		if (nextPlayer < playerCount) {
			setCurrentPlayer(nextPlayer);
			setPhase("handoff");
		} else {
			/* all players done � add round scores to totals */
			setScores((prev) => prev.map((s, i) => s + newRoundScores[i]));
			setPhase("roundEnd");
		}
	};

	const handleCellPress = (index: number) => {
		if (phase !== "playing") return;
		if (foundCells.has(index)) return;

		if (grid[index] === target) {
			haptic.success();
			const newFound = new Set(foundCells);
			newFound.add(index);
			setFoundCells(newFound);
			setTurnScore((s) => s + 10);

			setTimeout(() => {
				const available = grid
					.map((emoji, i) => ({ emoji, i }))
					.filter(({ i }) => !newFound.has(i));
				if (available.length === 0) {
					endTurn();
					return;
				}
				const pick = available[Math.floor(Math.random() * available.length)];
				setTarget(pick.emoji);
			}, 300);
		} else {
			haptic.error();
			setTurnScore((s) => Math.max(0, s - 2));
		}
	};

	const handleNextRound = () => {
		if (round >= ROUNDS) {
			updateProgress("duel-emoji-find", Math.max(...scores));
			setPhase("finished");
			return;
		}
		setRound((r) => r + 1);
		setCurrentPlayer(0);
		setRoundScores(Array(playerCount).fill(0));
		setPhase("handoff");
	};

	const pColor = (i: number) => PLAYER_COLORS[i % PLAYER_COLORS.length];

	/* SETUP */
	if (phase === "setup") {
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{t("efTitle")}</Text>
				<Text style={[styles.desc, { color: theme.mutedText }]}>
					{t("efDesc")}
				</Text>
				<Text style={[styles.subtitle, { color: theme.mutedText }]}>
					{t("mpSelectPlayers")}
				</Text>
				<RNView style={styles.countRow}>
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
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={startGame}
				>
					<Text style={styles.btnText}>{t("start")}</Text>
				</Pressable>
			</View>
		);
	}

	/* HANDOFF */
	if (phase === "handoff") {
		return (
			<View style={styles.root}>
				<RNView
					style={[
						styles.handoffDot,
						{ backgroundColor: pColor(currentPlayer) },
					]}
				/>
				<Text style={[styles.title, { color: pColor(currentPlayer) }]}>
					{t("mpPlayerN", { n: currentPlayer + 1 })}
				</Text>
				<Text style={[styles.desc, { color: theme.mutedText }]}>
					{t("efHandoff", { seconds: getRoundTime(round) })}
				</Text>
				<Pressable
					style={[styles.btn, { backgroundColor: pColor(currentPlayer) }]}
					onPress={startTurn}
				>
					<Text style={styles.btnText}>{t("efGo")}</Text>
				</Pressable>
			</View>
		);
	}

	/* FINISHED */
	if (phase === "finished") {
		const maxScore = Math.max(...scores);
		const winners = scores
			.map((s, i) => (s === maxScore ? i : -1))
			.filter((i) => i >= 0);
		const winnerName =
			winners.length === 1
				? t("dicePlayerWins", { player: String(winners[0] + 1) })
				: t("diceDraw");
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{winnerName}</Text>
				<RNView style={styles.finalTable}>
					{scores.map((s, i) => (
						<RNView
							key={i}
							style={[styles.finalRow, { borderColor: theme.border + "44" }]}
						>
							<RNView
								style={[styles.playerDot, { backgroundColor: pColor(i) }]}
							/>
							<Text style={[styles.finalName, { color: theme.text }]}>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<Text style={[styles.finalNum, { color: pColor(i) }]}>{s}</Text>
						</RNView>
					))}
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={() => setPhase("setup")}
				>
					<Text style={styles.btnText}>{t("playAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	/* ROUND END */
	if (phase === "roundEnd") {
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{t("efRoundOver", { round })}</Text>
				<RNView style={styles.finalTable}>
					{roundScores.map((rs, i) => (
						<RNView
							key={i}
							style={[styles.finalRow, { borderColor: theme.border + "44" }]}
						>
							<RNView
								style={[styles.playerDot, { backgroundColor: pColor(i) }]}
							/>
							<Text style={[styles.finalName, { color: theme.text }]}>
								{t("mpPlayerN", { n: i + 1 })}
							</Text>
							<Text style={[styles.roundPts, { color: pColor(i) }]}>+{rs}</Text>
							<Text style={[styles.totalPts, { color: theme.mutedText }]}>
								{scores[i]}
							</Text>
						</RNView>
					))}
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={handleNextRound}
				>
					<Text style={styles.btnText}>
						{round >= ROUNDS ? t("efSeeResult") : t("efNextRound")}
					</Text>
				</Pressable>
			</View>
		);
	}

	/* PLAYING */
	const timerColor =
		timeLeft <= 5 ? "#ef5350" : timeLeft <= 10 ? "#ffa726" : theme.text;
	const curColor = pColor(currentPlayer);

	return (
		<View style={styles.root}>
			{/* HUD */}
			<RNView style={styles.hud}>
				<RNView style={styles.hudBlock}>
					<RNView style={[styles.hudDot, { backgroundColor: curColor }]} />
					<Text style={[styles.hudLabel, { color: curColor }]}>
						{t("mpPlayerN", { n: currentPlayer + 1 })}
					</Text>
					<Text style={[styles.hudScore, { color: curColor }]}>
						{turnScore}
					</Text>
				</RNView>
				<RNView style={styles.hudCenter}>
					<Text style={[styles.timerText, { color: timerColor }]}>
						{timeLeft}s
					</Text>
					<Text style={[styles.roundHint, { color: theme.mutedText }]}>
						{t("efRound", { round, total: ROUNDS })}
					</Text>
				</RNView>
			</RNView>

			{/* Target */}
			<RNView
				style={[
					styles.targetCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.findLabel, { color: theme.mutedText }]}>
					{t("efFind")}
				</Text>
				<Text style={styles.targetEmoji}>{target}</Text>
			</RNView>

			{/* Grid */}
			<RNView style={styles.grid}>
				{grid.map((emoji, i) => {
					const found = foundCells.has(i);
					return (
						<Pressable
							key={`cell-${i}`}
							style={[
								styles.cell,
								{
									backgroundColor: found ? theme.card : theme.elevated,
									borderColor: found ? theme.border : "transparent",
									opacity: found ? 0.3 : 1,
								},
							]}
							onPress={() => handleCellPress(i)}
						>
							<Text style={styles.cellEmoji}>{emoji}</Text>
						</Pressable>
					);
				})}
			</RNView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	title: { fontSize: 24, fontWeight: "900", marginBottom: 8 },
	subtitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
	desc: { fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 20 },
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
	btn: {
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
		marginTop: 12,
	},
	btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	handoffDot: { width: 40, height: 40, borderRadius: 20, marginBottom: 12 },
	hud: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		marginBottom: 8,
	},
	hudBlock: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		justifyContent: "center",
	},
	hudDot: { width: 10, height: 10, borderRadius: 5 },
	hudLabel: { fontSize: 11, fontWeight: "800" },
	hudScore: { fontSize: 22, fontWeight: "900" },
	hudCenter: { alignItems: "center" },
	timerText: { fontSize: 28, fontWeight: "900" },
	roundHint: { fontSize: 10, fontWeight: "700" },
	targetCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 14,
		borderWidth: 1,
		marginBottom: 10,
	},
	findLabel: { fontSize: 13, fontWeight: "700" },
	targetEmoji: { fontSize: 32 },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: CELL_GAP,
		justifyContent: "center",
	},
	cell: {
		width: CELL_SIZE,
		height: CELL_SIZE,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	cellEmoji: { fontSize: CELL_SIZE * 0.45 },
	finalTable: { width: "100%", gap: 6, marginBottom: 12 },
	finalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderBottomWidth: 1,
	},
	playerDot: { width: 10, height: 10, borderRadius: 5 },
	finalName: { fontSize: 16, fontWeight: "700", flex: 1 },
	finalNum: { fontSize: 24, fontWeight: "900" },
	roundPts: { fontSize: 16, fontWeight: "800", width: 50, textAlign: "right" },
	totalPts: { fontSize: 14, fontWeight: "600", width: 40, textAlign: "right" },
});
