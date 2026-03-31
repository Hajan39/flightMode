import { useCallback, useEffect, useRef, useState } from "react";
import {
	Dimensions,
	Pressable,
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
const ROUND_TIME = 30; // seconds per round
const ROUNDS = 3;

const EMOJI_POOL = [
	"✈️",
	"🛫",
	"🛬",
	"🚁",
	"🛩️",
	"🪂",
	"🎒",
	"🧳",
	"🗺️",
	"🌍",
	"⛅",
	"🌤️",
	"☁️",
	"🌈",
	"⭐",
	"🌙",
	"🔭",
	"🧭",
	"⚡",
	"🌊",
	"🏔️",
	"🏝️",
	"🗼",
	"🗽",
	"🎡",
	"🏰",
	"⛩️",
	"🕌",
	"🎌",
	"🚢",
	"🚀",
	"🛸",
	"🎯",
	"🎪",
	"🎠",
	"🎢",
	"🚂",
	"🚤",
	"⛵",
	"🏖️",
	"🌴",
	"🌺",
	"🦅",
	"🦜",
	"🐬",
	"🦋",
	"🌻",
	"🍀",
	"💎",
	"🔑",
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
	// Pick a target that appears exactly once
	const target = grid[Math.floor(Math.random() * grid.length)];
	return { grid, target };
}

export default function DuelEmojiFindGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<
		"ready" | "playing" | "roundEnd" | "finished"
	>("ready");
	const [round, setRound] = useState(1);
	const [grid, setGrid] = useState<string[]>([]);
	const [target, setTarget] = useState("");
	const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
	const [scoreP1, setScoreP1] = useState(0);
	const [scoreP2, setScoreP2] = useState(0);
	const [roundScoreP1, setRoundScoreP1] = useState(0);
	const [roundScoreP2, setRoundScoreP2] = useState(0);
	const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startRound = useCallback(() => {
		const { grid: g, target: tgt } = generateRound();
		setGrid(g);
		setTarget(tgt);
		setTimeLeft(ROUND_TIME);
		setRoundScoreP1(0);
		setRoundScoreP2(0);
		setFoundCells(new Set());
		setPhase("playing");
	}, []);

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

	useEffect(() => {
		if (phase === "playing" && timeLeft === 0) {
			// End round
			setScoreP1((s) => s + roundScoreP1);
			setScoreP2((s) => s + roundScoreP2);
			setPhase("roundEnd");
		}
	}, [timeLeft, phase, roundScoreP1, roundScoreP2]);

	const handleCellPress = (index: number, player: 1 | 2) => {
		if (phase !== "playing") return;
		if (foundCells.has(index)) return;

		if (grid[index] === target) {
			haptic.success();
			const newFound = new Set(foundCells);
			newFound.add(index);
			setFoundCells(newFound);

			if (player === 1) setRoundScoreP1((s) => s + 10);
			else setRoundScoreP2((s) => s + 10);

			// Pick new target after brief delay
			setTimeout(() => {
				const available = grid
					.map((emoji, i) => ({ emoji, i }))
					.filter(({ i }) => !newFound.has(i));
				if (available.length === 0) {
					// All found, end round early
					setScoreP1((s) => s + roundScoreP1 + (player === 1 ? 10 : 0));
					setScoreP2((s) => s + roundScoreP2 + (player === 2 ? 10 : 0));
					setPhase("roundEnd");
					if (timerRef.current) clearInterval(timerRef.current);
					return;
				}
				const pick = available[Math.floor(Math.random() * available.length)];
				setTarget(pick.emoji);
			}, 300);
		} else {
			haptic.error();
			// penalty: -2 points
			if (player === 1) setRoundScoreP1((s) => Math.max(0, s - 2));
			else setRoundScoreP2((s) => Math.max(0, s - 2));
		}
	};

	const handleNextRound = () => {
		if (round >= ROUNDS) {
			const total1 = scoreP1;
			const total2 = scoreP2;
			updateProgress("duel-emoji-find", Math.max(total1, total2));
			setPhase("finished");
			return;
		}
		setRound((r) => r + 1);
		startRound();
	};

	const handleRestart = () => {
		setRound(1);
		setScoreP1(0);
		setScoreP2(0);
		setPhase("ready");
	};

	// Ready screen
	if (phase === "ready") {
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{t("efTitle")}</Text>
				<Text style={[styles.desc, { color: theme.mutedText }]}>
					{t("efDesc")}
				</Text>
				<RNView style={styles.readyInfo}>
					<Text style={[styles.infoLine, { color: theme.text }]}>
						🎯 {t("efRules1")}
					</Text>
					<Text style={[styles.infoLine, { color: theme.text }]}>
						⏱️ {t("efRules2", { seconds: ROUND_TIME })}
					</Text>
					<Text style={[styles.infoLine, { color: theme.text }]}>
						🏁 {t("efRules3", { rounds: ROUNDS })}
					</Text>
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={startRound}
				>
					<Text style={styles.btnText}>{t("efStart")}</Text>
				</Pressable>
			</View>
		);
	}

	// Finished screen
	if (phase === "finished") {
		const winner =
			scoreP1 > scoreP2
				? t("c4Player1")
				: scoreP2 > scoreP1
					? t("c4Player2")
					: null;
		return (
			<View style={styles.root}>
				<Text style={styles.title}>
					{winner ? t("efWins", { player: winner }) : t("efDraw")}
				</Text>
				<RNView style={styles.finalScores}>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player1")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ef5350" }]}>
							{scoreP1}
						</Text>
					</RNView>
					<Text style={[styles.finalVs, { color: theme.mutedText }]}>vs</Text>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player2")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ffd54f" }]}>
							{scoreP2}
						</Text>
					</RNView>
				</RNView>
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={handleRestart}
				>
					<Text style={styles.btnText}>{t("playAgain")}</Text>
				</Pressable>
			</View>
		);
	}

	// Round end
	if (phase === "roundEnd") {
		return (
			<View style={styles.root}>
				<Text style={styles.title}>{t("efRoundOver", { round })}</Text>
				<RNView style={styles.finalScores}>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player1")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ef5350" }]}>
							+{roundScoreP1}
						</Text>
					</RNView>
					<Text style={[styles.finalVs, { color: theme.mutedText }]}>–</Text>
					<RNView style={styles.finalBlock}>
						<Text style={[styles.finalLabel, { color: theme.mutedText }]}>
							{t("c4Player2")}
						</Text>
						<Text style={[styles.finalNum, { color: "#ffd54f" }]}>
							+{roundScoreP2}
						</Text>
					</RNView>
				</RNView>
				<Text style={[styles.totalHint, { color: theme.mutedText }]}>
					{t("efTotal")}: {scoreP1} – {scoreP2}
				</Text>
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

	// Playing screen
	const timerColor =
		timeLeft <= 5 ? "#ef5350" : timeLeft <= 10 ? "#ffa726" : theme.text;

	return (
		<View style={styles.root}>
			{/* HUD */}
			<RNView style={styles.hud}>
				<RNView style={styles.hudBlock}>
					<RNView style={[styles.hudDot, { backgroundColor: "#ef5350" }]} />
					<Text style={[styles.hudScore, { color: "#ef5350" }]}>
						{roundScoreP1}
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
				<RNView style={styles.hudBlock}>
					<RNView style={[styles.hudDot, { backgroundColor: "#ffd54f" }]} />
					<Text style={[styles.hudScore, { color: "#ffd54f" }]}>
						{roundScoreP2}
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

			{/* Grid — P1 taps left half, P2 taps right half */}
			<RNView style={styles.gridContainer}>
				{/* P1 side indicator */}
				<RNView style={styles.sideIndicators}>
					<Text style={[styles.sideLabel, { color: "#ef5350" }]}>P1 ←</Text>
					<Text style={[styles.sideLabel, { color: "#ffd54f" }]}>→ P2</Text>
				</RNView>
				<RNView style={styles.grid}>
					{grid.map((emoji, i) => {
						const found = foundCells.has(i);
						return (
							<RNView key={`cell-${i}`} style={styles.cellWrapper}>
								{/* P1 tap zone (left half) */}
								<Pressable
									style={styles.halfLeft}
									onPress={() => handleCellPress(i, 1)}
								/>
								{/* P2 tap zone (right half) */}
								<Pressable
									style={styles.halfRight}
									onPress={() => handleCellPress(i, 2)}
								/>
								<RNView
									style={[
										styles.cellContent,
										{
											backgroundColor: found ? theme.card : theme.elevated,
											borderColor: found ? theme.border : "transparent",
											opacity: found ? 0.3 : 1,
										},
									]}
									pointerEvents="none"
								>
									<Text style={styles.cellEmoji}>{emoji}</Text>
								</RNView>
							</RNView>
						);
					})}
				</RNView>
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
	desc: { fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 20 },
	readyInfo: { gap: 8, marginBottom: 20, alignItems: "flex-start" },
	infoLine: { fontSize: 14, fontWeight: "600" },
	btn: {
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
		marginTop: 12,
	},
	btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
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
	gridContainer: { width: "100%" },
	sideIndicators: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 4,
		marginBottom: 4,
	},
	sideLabel: { fontSize: 11, fontWeight: "800" },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: CELL_GAP,
		justifyContent: "center",
	},
	cellWrapper: {
		width: CELL_SIZE,
		height: CELL_SIZE,
		position: "relative",
	},
	halfLeft: {
		position: "absolute",
		left: 0,
		top: 0,
		width: "50%",
		height: "100%",
		zIndex: 2,
	},
	halfRight: {
		position: "absolute",
		right: 0,
		top: 0,
		width: "50%",
		height: "100%",
		zIndex: 2,
	},
	cellContent: {
		width: "100%",
		height: "100%",
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	cellEmoji: { fontSize: CELL_SIZE * 0.45 },
	finalScores: {
		flexDirection: "row",
		alignItems: "center",
		gap: 20,
		marginTop: 8,
		marginBottom: 4,
	},
	finalBlock: { alignItems: "center", gap: 2 },
	finalLabel: { fontSize: 12, fontWeight: "700" },
	finalNum: { fontSize: 36, fontWeight: "900" },
	finalVs: { fontSize: 16, fontWeight: "700" },
	totalHint: { fontSize: 14, fontWeight: "600", marginTop: 4 },
});
