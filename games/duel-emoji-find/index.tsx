import { useEffect, useRef, useState } from "react";
import {
	Pressable,
	View as RNView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import {
	MatchResult,
	PassDeviceOverlay,
	PlayerScoreStrip,
	PlayerSetup,
	TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "duel-emoji-find";
const GRID_COLS = 5;
const GRID_ROWS = 6;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const CELL_GAP = 6;
const BASE_ROUND_TIME = 30;
const ROUNDS = 5;

function getRoundTime(round: number): number {
	return Math.max(15, BASE_ROUND_TIME - (round - 1) * 3);
}

const EMOJI_POOL = [
	"✈️", "🛫", "🛬", "🚁", "🛩️", "🪂", "🎒", "🧳", "🗺️", "🌍",
	"⛅", "🌤️", "☁️", "🌈", "⭐", "🌙", "🔭", "🧭", "⚡", "🌊",
	"🏔️", "🏝️", "🗼", "🗽", "🎡", "🏰", "⛩️", "🕌", "🎌", "🚢",
	"🚀", "🛸", "🎯", "🎪", "🎠", "🎢", "🚂", "🚤", "⛵", "🏖️",
	"🌴", "🌺", "🦅", "🦜", "🐬", "🦋", "🌻", "🍀", "💎", "🔑",
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

type Phase =
	| "setup"
	| "handoff"
	| "countdown"
	| "playing"
	| "roundEnd"
	| "finished";

export default function DuelEmojiFindGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width } = useWindowDimensions();
	const cellSize = Math.floor(
		(Math.min(width, 520) - Spacing.lg * 2 - CELL_GAP * (GRID_COLS - 1)) / GRID_COLS,
	);

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [round, setRound] = useState(1);
	const [currentPlayer, setCurrentPlayer] = useState(0);
	const [scores, setScores] = useState<number[]>([]);
	const [roundScores, setRoundScores] = useState<number[]>([]);
	const [grid, setGrid] = useState<string[]>([]);
	const [target, setTarget] = useState("");
	const [timeLeft, setTimeLeft] = useState(BASE_ROUND_TIME);
	const [turnScore, setTurnScore] = useState(0);
	const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
	const [paused, setPaused] = useState(false);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const retargetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const turnEndTimeRef = useRef<number | null>(null);
	const pausedRemainingRef = useRef<number | null>(null);
	const endTurnRef = useRef<() => void>(() => {});

	const clearTimers = () => {
		if (timerRef.current) clearInterval(timerRef.current);
		if (retargetRef.current) clearTimeout(retargetRef.current);
		timerRef.current = null;
		retargetRef.current = null;
	};

	useEffect(() => clearTimers, []);

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		clearTimers();
		setPlayers(matchPlayers);
		setScores(Array(matchPlayers.length).fill(0));
		setRoundScores(Array(matchPlayers.length).fill(0));
		setRound(1);
		setCurrentPlayer(0);
		setPaused(false);
		setProgress(undefined);
		setPhase("handoff");
	};

	const beginTurn = () => {
		const { grid: g, target: tgt } = generateRound();
		const roundSeconds = getRoundTime(round);
		setGrid(g);
		setTarget(tgt);
		setTimeLeft(roundSeconds);
		turnEndTimeRef.current = Date.now() + roundSeconds * 1000;
		setTurnScore(0);
		setFoundCells(new Set());
		setPhase("playing");
	};

	// Wall-clock deadline timer (CLAUDE.md timer rule); pauses by freezing the remaining ms.
	useEffect(() => {
		if (phase !== "playing" || paused) return;
		const tick = () => {
			const endTime = turnEndTimeRef.current;
			if (!endTime) return;
			const remainingMs = endTime - Date.now();
			setTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
			if (remainingMs <= 0 && timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
		tick();
		timerRef.current = setInterval(tick, 100);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			timerRef.current = null;
		};
	}, [phase, paused]);

	const endTurn = () => {
		clearTimers();
		turnEndTimeRef.current = null;
		const newRoundScores = [...roundScores];
		newRoundScores[currentPlayer] = turnScore;
		setRoundScores(newRoundScores);

		const nextPlayer = currentPlayer + 1;
		if (nextPlayer < players.length) {
			setCurrentPlayer(nextPlayer);
			setPhase("handoff");
		} else {
			setScores((prev) => prev.map((s, i) => s + newRoundScores[i]));
			setPhase("roundEnd");
		}
	};
	endTurnRef.current = endTurn;

	useEffect(() => {
		if (phase !== "playing" || paused || timeLeft > 0) return;
		endTurnRef.current();
	}, [timeLeft, phase, paused]);

	const handleCellPress = (index: number) => {
		if (phase !== "playing" || paused || foundCells.has(index)) return;

		if (grid[index] === target) {
			haptic.success();
			const newFound = new Set(foundCells);
			newFound.add(index);
			setFoundCells(newFound);
			setTurnScore((s) => s + 10);

			if (retargetRef.current) clearTimeout(retargetRef.current);
			retargetRef.current = setTimeout(() => {
				retargetRef.current = null;
				const available = grid
					.map((emoji, i) => ({ emoji, i }))
					.filter(({ i }) => !newFound.has(i));
				if (available.length === 0) {
					endTurnRef.current();
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
			setProgress(recordMatch(GAME_ID, scores.map((score) => ({ score }))));
			setPhase("finished");
			return;
		}
		setRound((r) => r + 1);
		setCurrentPlayer(0);
		setRoundScores(Array(players.length).fill(0));
		setPhase("handoff");
	};

	const pause = () => {
		if (phase !== "playing" || paused) return;
		pausedRemainingRef.current = Math.max(
			0,
			(turnEndTimeRef.current ?? Date.now()) - Date.now(),
		);
		setPaused(true);
	};
	const resume = () => {
		turnEndTimeRef.current = Date.now() + (pausedRemainingRef.current ?? 0);
		pausedRemainingRef.current = null;
		setPaused(false);
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("efTitle")}
				subtitle={t("efDesc")}
				minPlayers={2}
				onStart={startMatch}
			/>
		);
	}

	const current = players[Math.min(currentPlayer, players.length - 1)];
	const timerColor =
		timeLeft <= 5 ? theme.danger : timeLeft <= 10 ? theme.warning : theme.text;

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={current}
					compact
					right={
						<Text style={[styles.roundChip, { color: theme.mutedText }]}>
							{t("mpRoundOf", { round, total: ROUNDS })}
						</Text>
					}
				/>
				<GameControls
					onPause={phase === "playing" ? pause : undefined}
					onReset={() => startMatch(players)}
				/>
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={scores.map((s, i) =>
					phase === "playing" && i === currentPlayer ? s + turnScore : s,
				)}
				activeIndex={phase === "playing" ? currentPlayer : undefined}
				detail={(i) =>
					phase === "roundEnd" ? `+${roundScores[i]}` : undefined
				}
			/>

			{phase === "playing" || phase === "countdown" ? (
				<>
					<RNView style={styles.hud}>
						<Text style={[styles.timerText, { color: timerColor }]}>
							{phase === "playing" ? `${timeLeft}s` : `${getRoundTime(round)}s`}
						</Text>
						<RNView
							style={[
								styles.targetCard,
								{ backgroundColor: theme.card, borderColor: current.color },
							]}
						>
							<Text style={[styles.findLabel, { color: theme.mutedText }]}>
								{t("efFind")}
							</Text>
							<Text style={styles.targetEmoji}>{phase === "playing" ? target : "❔"}</Text>
						</RNView>
						<Text style={[styles.turnScore, { color: current.color }]}>
							+{turnScore}
						</Text>
					</RNView>

					<RNView style={styles.grid}>
						{(phase === "playing" ? grid : Array(TOTAL_CELLS).fill("")).map(
							(emoji, i) => {
								const found = foundCells.has(i);
								return (
									<Pressable
										key={`cell-${i}`}
										style={[
											styles.cell,
											{
												width: cellSize,
												height: cellSize,
												backgroundColor: found ? theme.card : theme.elevated,
												borderColor: found ? theme.border : "transparent",
												opacity: found ? 0.3 : 1,
											},
										]}
										onPress={() => handleCellPress(i)}
										disabled={phase !== "playing"}
										accessibilityRole="button"
										accessibilityLabel={emoji}
									>
										<Text style={{ fontSize: cellSize * 0.45 }}>{emoji}</Text>
									</Pressable>
								);
							},
						)}
					</RNView>
				</>
			) : null}

			{phase === "roundEnd" ? (
				<RNView style={styles.roundEnd}>
					<Text style={[styles.roundEndTitle, { color: theme.text }]}>
						{t("efRoundOver", { round })}
					</Text>
					<Pressable
						style={[styles.btn, { backgroundColor: theme.tint }]}
						onPress={() => {
							haptic.tap();
							handleNextRound();
						}}
						accessibilityRole="button"
						accessibilityLabel={round >= ROUNDS ? t("efSeeResult") : t("efNextRound")}
					>
						<Text style={[styles.btnText, { color: theme.onTint }]}>
							{round >= ROUNDS ? t("efSeeResult") : t("efNextRound")}
						</Text>
					</Pressable>
				</RNView>
			) : null}

			<PassDeviceOverlay
				visible={phase === "handoff"}
				toPlayer={current}
				hint={t("efHandoff", { seconds: getRoundTime(round) })}
				readyLabel={t("efGo")}
				onReady={() => setPhase("countdown")}
			/>
			{phase === "countdown" ? <GameCountdown onComplete={beginTurn} /> : null}
			<GamePauseOverlay
				visible={paused}
				onResume={resume}
				onRestart={() => {
					setPaused(false);
					startMatch(players);
				}}
			/>
			{phase === "finished" ? (
				<MatchResult
					standings={players.map((p, i) => ({ player: p, score: scores[i] }))}
					winnerIndex={getSoleWinnerIndex(scores.map((score) => ({ score })))}
					scoreLabel={t("mpPoints")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "stretch",
		padding: Spacing.lg,
		paddingTop: Spacing.sm,
		gap: Spacing.md,
	},
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	roundChip: { ...TextStyle.chipLabel },
	hud: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	timerText: { ...TextStyle.statValueMedium, minWidth: 64 },
	targetCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.button,
		borderWidth: 1.5,
	},
	findLabel: { ...TextStyle.statLabel },
	targetEmoji: { fontSize: 32 },
	turnScore: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black, minWidth: 56, textAlign: "right" },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: CELL_GAP,
		justifyContent: "center",
	},
	cell: {
		borderRadius: Radius.md,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	roundEnd: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.lg },
	roundEndTitle: { fontSize: FontSize["2xl"], fontWeight: FontWeight.black },
	btn: {
		paddingHorizontal: Spacing["4xl"],
		paddingVertical: Spacing.lg,
		borderRadius: Radius.button,
	},
	btnText: { ...TextStyle.buttonSecondary },
});
