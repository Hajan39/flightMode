import { useEffect, useMemo, useState } from "react";
import { Pressable, View as RNView, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
	FadeInDown,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
	MatchResult,
	OptionChips,
	PlayerScoreStrip,
	PlayerSetup,
	TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { GameProgressUpdate } from "@/types/game";
import { getSoleWinnerIndex, recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "duel-connect4";
const ROWS = 6;
const COLS = 7;
const BOARD_PAD = 16;
const GAP = 4;

type Player = 0 | 1;
type Cell = -1 | Player;
type Board = Cell[][];
type RoundWinner = Player | "draw" | null;
type Phase = "setup" | "playing" | "done";

const DIRECTIONS = [
	[0, 1],
	[1, 0],
	[1, 1],
	[1, -1],
] as const;

function createBoard(): Board {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(-1) as Cell[]);
}

function dropPiece(board: Board, col: number, player: Player): Board | null {
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r][col] === -1) {
			const next = board.map((row) => [...row]) as Board;
			next[r][col] = player;
			return next;
		}
	}
	return null;
}

/** Winner + the cells of every 4-line, computed once per board change. */
function evaluate(board: Board): { winner: RoundWinner; winCells: Set<string> } {
	const winCells = new Set<string>();
	let winner: RoundWinner = null;
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const p = board[r][c];
			if (p === -1) continue;
			for (const [dr, dc] of DIRECTIONS) {
				const line: string[] = [`${r},${c}`];
				for (let i = 1; i < 4; i++) {
					const nr = r + dr * i;
					const nc = c + dc * i;
					if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
					if (board[nr][nc] !== p) break;
					line.push(`${nr},${nc}`);
				}
				if (line.length >= 4) {
					winner = p;
					for (const key of line) winCells.add(key);
				}
			}
		}
	}
	if (winner === null && board[0].every((c) => c !== -1)) winner = "draw";
	return { winner, winCells };
}

function Disc({ color, isWin, size }: { color: string; isWin: boolean; size: number }) {
	const scale = useSharedValue(1);
	useEffect(() => {
		scale.value = isWin
			? withRepeat(
					withSequence(withTiming(1.12, { duration: 200 }), withTiming(1, { duration: 200 })),
					3,
				)
			: 1;
	}, [isWin, scale]);
	const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
	return (
		<Animated.View
			entering={FadeInDown.duration(160)}
			style={[
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: color,
					borderColor: isWin ? "#fff" : "transparent",
					borderWidth: isWin ? 2 : 0,
				},
				animatedStyle,
			]}
		/>
	);
}

export default function DuelConnect4Game() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width } = useWindowDimensions();
	const cellSize = Math.floor((Math.min(width, 520) - BOARD_PAD * 2 - 16 - GAP * (COLS - 1)) / COLS);

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("setup");
	const [board, setBoard] = useState<Board>(createBoard);
	const [currentPlayer, setCurrentPlayer] = useState<Player>(0);
	const [wins, setWins] = useState<[number, number]>([0, 0]);
	const [draws, setDraws] = useState(0);
	const [matchTarget, setMatchTarget] = useState<2 | 3>(2);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	const { winner, winCells } = useMemo(() => evaluate(board), [board]);
	const roundOver = winner !== null;

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		setPlayers(matchPlayers);
		setBoard(createBoard());
		setCurrentPlayer(0);
		setWins([0, 0]);
		setDraws(0);
		setProgress(undefined);
		setPhase("playing");
	};

	const handleDrop = (col: number) => {
		if (roundOver || phase !== "playing") return;
		const next = dropPiece(board, col, currentPlayer);
		if (!next) return;
		haptic.tap();
		setBoard(next);

		const result = evaluate(next).winner;
		if (result === 0 || result === 1) {
			const nextWins: [number, number] = [...wins] as [number, number];
			nextWins[result] += 1;
			setWins(nextWins);
			if (nextWins[result] >= matchTarget) {
				haptic.heavy();
				setProgress(recordMatch(GAME_ID, nextWins.map((score) => ({ score }))));
				setPhase("done");
			} else {
				haptic.success();
			}
			return;
		}
		if (result === "draw") {
			haptic.tap();
			setDraws((d) => d + 1);
			return;
		}
		setCurrentPlayer(currentPlayer === 0 ? 1 : 0);
	};

	const nextRound = () => {
		haptic.tap();
		setBoard(createBoard());
		// The player who did NOT win the last round starts.
		setCurrentPlayer(winner === 0 ? 1 : winner === 1 ? 0 : currentPlayer === 0 ? 1 : 0);
	};

	if (phase === "setup") {
		return (
			<PlayerSetup
				title={t("gameDuelConnect4Name")}
				fixedCount={2}
				onStart={startMatch}
			>
				<OptionChips
					label={t("mpMatchSettings")}
					value={matchTarget}
					onChange={setMatchTarget}
					options={[
						{ value: 2, label: t("c4BestOf3") },
						{ value: 3, label: t("c4BestOf5") },
					]}
				/>
			</PlayerSetup>
		);
	}

	const current = players[currentPlayer];
	const statusLabel =
		winner === null
			? undefined
			: winner === "draw"
				? t("mpRoundDraw")
				: t("mpWinsRound", { player: players[winner].name });
	const boardBg = colorScheme === "dark" ? "#1a237e" : "#283593";
	const holeBg = colorScheme === "dark" ? "#0d1236" : "#e8eaf6";

	return (
		<View style={styles.root}>
			<RNView style={styles.topRow}>
				<TurnBanner
					player={winner !== null && winner !== "draw" ? players[winner] : current}
					label={statusLabel}
					compact
				/>
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={wins}
				activeIndex={roundOver ? undefined : currentPlayer}
				detail={() => t("tttDrawCount", { count: draws })}
			/>

			<RNView style={[styles.board, { backgroundColor: boardBg }]}>
				<RNView style={styles.colButtons}>
					{Array.from({ length: COLS }).map((_, c) => (
						<Pressable
							key={`col-${c}`}
							style={[styles.colBtn, { width: cellSize }]}
							hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
							onPress={() => handleDrop(c)}
							accessibilityRole="button"
							accessibilityLabel={t("a11yDropInColumn", { col: c + 1 })}
						>
							{!roundOver ? (
								<RNView style={[styles.dropArrow, { borderTopColor: current.color }]} />
							) : null}
						</Pressable>
					))}
				</RNView>

				{board.map((row, r) => (
					<RNView key={`r-${r}`} style={styles.row}>
						{row.map((cell, c) => (
							<Pressable
								key={`${r}-${c}`}
								style={[
									styles.cell,
									{ width: cellSize, height: cellSize, borderRadius: cellSize / 2, backgroundColor: holeBg },
								]}
								onPress={() => handleDrop(c)}
								accessibilityLabel={t("a11yDropInColumn", { col: c + 1 })}
							>
								{cell !== -1 ? (
									<Disc color={players[cell].color} isWin={winCells.has(`${r},${c}`)} size={cellSize} />
								) : null}
							</Pressable>
						))}
					</RNView>
				))}
			</RNView>

			{roundOver && phase === "playing" ? (
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={nextRound}
					accessibilityRole="button"
					accessibilityLabel={t("c4NextRound")}
				>
					<Text style={[styles.btnText, { color: theme.onTint }]}>{t("c4NextRound")}</Text>
				</Pressable>
			) : null}

			{phase === "done" ? (
				<MatchResult
					standings={players.map((p, i) => ({ player: p, score: wins[i] }))}
					winnerIndex={getSoleWinnerIndex(wins.map((score) => ({ score })))}
					scoreLabel={t("mpWinsLabel")}
					subtitle={t("tttDrawCount", { count: draws })}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("setup")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, alignItems: "stretch", padding: BOARD_PAD, paddingTop: Spacing.sm, gap: Spacing.md },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	board: { borderRadius: Radius.card, padding: 8, alignSelf: "center" },
	colButtons: { flexDirection: "row", gap: GAP, marginBottom: 4 },
	colBtn: { height: 18, alignItems: "center", justifyContent: "center" },
	dropArrow: {
		width: 0,
		height: 0,
		borderLeftWidth: 6,
		borderRightWidth: 6,
		borderTopWidth: 8,
		borderLeftColor: "transparent",
		borderRightColor: "transparent",
	},
	row: { flexDirection: "row", gap: GAP, marginBottom: GAP },
	cell: { alignItems: "center", justifyContent: "center" },
	btn: { paddingHorizontal: Spacing["4xl"], paddingVertical: Spacing.lg, borderRadius: Radius.button, alignSelf: "center" },
	btnText: { ...TextStyle.buttonSecondary },
});
