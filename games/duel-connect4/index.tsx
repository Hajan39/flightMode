import { useState } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";
import { View as RNView } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

const ROWS = 6;
const COLS = 7;
const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_PAD = 16;
const GAP = 4;
const CELL_SIZE = Math.floor(
	(SCREEN_W - BOARD_PAD * 2 - GAP * (COLS - 1)) / COLS,
);

type Player = 1 | 2;
type Cell = 0 | Player;
type Board = Cell[][];
type Winner = Player | "draw" | null;

const PLAYER_COLORS: Record<Player, string> = {
	1: "#ef5350",
	2: "#ffd54f",
};

function createBoard(): Board {
	return Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
}

function dropPiece(board: Board, col: number, player: Player): Board | null {
	for (let r = ROWS - 1; r >= 0; r--) {
		if (board[r][col] === 0) {
			const next = board.map((row) => [...row]) as Board;
			next[r][col] = player;
			return next;
		}
	}
	return null;
}

function checkWinner(board: Board): Winner {
	const directions = [
		[0, 1],
		[1, 0],
		[1, 1],
		[1, -1],
	];
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const p = board[r][c];
			if (p === 0) continue;
			for (const [dr, dc] of directions) {
				let count = 1;
				for (let i = 1; i < 4; i++) {
					const nr = r + dr * i;
					const nc = c + dc * i;
					if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
					if (board[nr][nc] !== p) break;
					count++;
				}
				if (count >= 4) return p as Player;
			}
		}
	}
	// Check draw
	if (board[0].every((c) => c !== 0)) return "draw";
	return null;
}

function getWinCells(board: Board): Set<string> {
	const cells = new Set<string>();
	const directions = [
		[0, 1],
		[1, 0],
		[1, 1],
		[1, -1],
	];
	for (let r = 0; r < ROWS; r++) {
		for (let c = 0; c < COLS; c++) {
			const p = board[r][c];
			if (p === 0) continue;
			for (const [dr, dc] of directions) {
				const line: string[] = [`${r},${c}`];
				for (let i = 1; i < 4; i++) {
					const nr = r + dr * i;
					const nc = c + dc * i;
					if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
					if (board[nr][nc] !== p) break;
					line.push(`${nr},${nc}`);
				}
				if (line.length >= 4) {
					for (const key of line) cells.add(key);
				}
			}
		}
	}
	return cells;
}

export default function DuelConnect4Game() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [board, setBoard] = useState<Board>(createBoard);
	const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
	const [winsP1, setWinsP1] = useState(0);
	const [winsP2, setWinsP2] = useState(0);
	const [matchTarget, setMatchTarget] = useState(2);
	const [matchWinner, setMatchWinner] = useState<Player | null>(null);

	const winner = checkWinner(board);
	const winCells =
		winner && winner !== "draw" ? getWinCells(board) : new Set<string>();

	const handleDrop = (col: number) => {
		if (winner !== null || matchWinner !== null) return;
		const next = dropPiece(board, col, currentPlayer);
		if (!next) return;

		haptic.tap();
		setBoard(next);

		const result = checkWinner(next);
		if (result === 1 || result === 2) {
			haptic.heavy();
			const setter = result === 1 ? setWinsP1 : setWinsP2;
			const newWins = (result === 1 ? winsP1 : winsP2) + 1;
			setter(newWins);
			updateProgress("duel-connect4", newWins);
			if (newWins >= matchTarget) {
				setMatchWinner(result);
			}
			return;
		}
		setCurrentPlayer(currentPlayer === 1 ? 2 : 1);
	};

	const resetBoard = () => {
		setBoard(createBoard());
		setCurrentPlayer(1);
	};

	const resetMatch = () => {
		setBoard(createBoard());
		setCurrentPlayer(1);
		setWinsP1(0);
		setWinsP2(0);
		setMatchWinner(null);
	};

	const roundOver = winner !== null;

	const statusText = matchWinner
		? t("c4MatchWin", { player: String(matchWinner) })
		: winner === "draw"
			? t("c4Draw")
			: winner !== null
				? t("c4RoundWin", { player: String(winner) })
				: t("c4Turn", { player: String(currentPlayer) });

	const statusColor = matchWinner
		? PLAYER_COLORS[matchWinner]
		: winner === "draw"
			? theme.mutedText
			: winner !== null
				? PLAYER_COLORS[winner]
				: PLAYER_COLORS[currentPlayer];

	return (
		<View style={styles.root}>
			{/* Score strip */}
			<RNView style={styles.scoreStrip}>
				<RNView style={styles.scoreBlock}>
					<RNView
						style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[1] }]}
					/>
					<Text style={[styles.scoreName, { color: theme.mutedText }]}>
						{t("c4Player1")}
					</Text>
					<Text
						style={[
							styles.scoreNum,
							{
								color:
									currentPlayer === 1 && !roundOver
										? PLAYER_COLORS[1]
										: theme.text,
							},
						]}
					>
						{winsP1}
					</Text>
				</RNView>
				<RNView style={styles.scoreCenter}>
					<Text style={[styles.vs, { color: theme.mutedText }]}>vs</Text>
				</RNView>
				<RNView style={[styles.scoreBlock, styles.scoreRight]}>
					<RNView
						style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[2] }]}
					/>
					<Text style={[styles.scoreName, { color: theme.mutedText }]}>
						{t("c4Player2")}
					</Text>
					<Text
						style={[
							styles.scoreNum,
							{
								color:
									currentPlayer === 2 && !roundOver
										? PLAYER_COLORS[2]
										: theme.text,
							},
						]}
					>
						{winsP2}
					</Text>
				</RNView>
			</RNView>

			{/* Mode chips */}
			<RNView style={styles.modeRow}>
				{([2, 3] as const).map((tw) => (
					<Pressable
						key={tw}
						style={[
							styles.modeChip,
							{
								borderColor: theme.border,
								backgroundColor: matchTarget === tw ? theme.tint : theme.card,
							},
						]}
						onPress={() => {
							setMatchTarget(tw);
							resetMatch();
						}}
					>
						<Text
							style={[
								styles.modeText,
								{ color: matchTarget === tw ? "#fff" : theme.mutedText },
							]}
						>
							{tw === 2 ? t("c4BestOf3") : t("c4BestOf5")}
						</Text>
					</Pressable>
				))}
			</RNView>

			{/* Status */}
			<Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>

			{/* Board */}
			<RNView
				style={[
					styles.board,
					{
						backgroundColor: colorScheme === "dark" ? "#1a237e" : "#283593",
					},
				]}
			>
				{/* Column drop buttons */}
				<RNView style={styles.colButtons}>
					{Array.from({ length: COLS }).map((_, c) => (
						<Pressable
							key={`col-${c}`}
							style={styles.colBtn}
							onPress={() => handleDrop(c)}
						>
							{!roundOver && !matchWinner && (
								<RNView
									style={[
										styles.dropArrow,
										{ borderTopColor: PLAYER_COLORS[currentPlayer] },
									]}
								/>
							)}
						</Pressable>
					))}
				</RNView>

				{/* Grid */}
				{board.map((row, r) => (
					<RNView key={`r-${r}`} style={styles.row}>
						{row.map((cell, c) => {
							const isWin = winCells.has(`${r},${c}`);
							return (
								<Pressable
									key={`${r}-${c}`}
									style={[
										styles.cell,
										{
											backgroundColor:
												cell === 0
													? colorScheme === "dark"
														? "#0d1236"
														: "#e8eaf6"
													: PLAYER_COLORS[cell as Player],
											borderColor: isWin ? "#fff" : "transparent",
											borderWidth: isWin ? 2 : 0,
										},
									]}
									onPress={() => handleDrop(c)}
								/>
							);
						})}
					</RNView>
				))}
			</RNView>

			{/* Actions */}
			{roundOver && !matchWinner && (
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={resetBoard}
				>
					<Text style={styles.btnText}>{t("c4NextRound")}</Text>
				</Pressable>
			)}
			{matchWinner && (
				<Pressable
					style={[styles.btn, { backgroundColor: theme.tint }]}
					onPress={resetMatch}
				>
					<Text style={styles.btnText}>{t("c4NewMatch")}</Text>
				</Pressable>
			)}
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
	scoreStrip: {
		flexDirection: "row",
		alignItems: "center",
		width: "100%",
		marginBottom: 8,
	},
	scoreBlock: { flex: 1, alignItems: "center", gap: 2 },
	scoreRight: {},
	playerDot: { width: 12, height: 12, borderRadius: 6 },
	scoreName: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
	scoreNum: { fontSize: 32, fontWeight: "900" },
	scoreCenter: { paddingHorizontal: 12 },
	vs: { fontSize: 14, fontWeight: "700" },
	modeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
	modeChip: {
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 20,
		borderWidth: 1,
	},
	modeText: { fontSize: 12, fontWeight: "700" },
	status: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
	board: {
		borderRadius: 12,
		padding: 8,
	},
	colButtons: {
		flexDirection: "row",
		gap: GAP,
		marginBottom: 4,
	},
	colBtn: {
		width: CELL_SIZE,
		height: 18,
		alignItems: "center",
		justifyContent: "center",
	},
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
	cell: {
		width: CELL_SIZE,
		height: CELL_SIZE,
		borderRadius: CELL_SIZE / 2,
	},
	btn: {
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 12,
		marginTop: 14,
	},
	btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
