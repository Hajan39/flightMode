import { useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_GAP = 10;
const BOARD_PADDING = 20;
const CLASSIC_BOARD_SIZE = 3;
const GROWING_START_SIZE = 5;
const GROWING_MAX_SIZE = 30;
const CLASSIC_WIN_LENGTH = 3;
const GROWING_WIN_LENGTH = 5;
const CLASSIC_CELL_SIZE = Math.min(
	92,
	Math.floor(
		(SCREEN_W - BOARD_PADDING * 2 - BOARD_GAP * (CLASSIC_BOARD_SIZE - 1)) /
			CLASSIC_BOARD_SIZE,
	),
);
const GROWING_CELL_SIZE = Math.min(
	56,
	Math.floor(
		(SCREEN_W - BOARD_PADDING * 2 - BOARD_GAP * (GROWING_START_SIZE - 1)) /
			GROWING_START_SIZE,
	),
);

type CellValue = "X" | "O" | null;
type Winner = "X" | "O" | "draw" | null;
type Player = "X" | "O";
type BoardMode = "classic" | "growing";
type Board = Record<string, Player>;
type Bounds = {
	minRow: number;
	maxRow: number;
	minCol: number;
	maxCol: number;
};

const DIRECTIONS = [
	[1, 0],
	[0, 1],
	[1, 1],
	[1, -1],
] as const;

function createInitialBounds(mode: BoardMode): Bounds {
	const size = mode === "classic" ? CLASSIC_BOARD_SIZE : GROWING_START_SIZE;
	return {
		minRow: 0,
		maxRow: size - 1,
		minCol: 0,
		maxCol: size - 1,
	};
}

function keyOf(row: number, col: number) {
	return `${row}:${col}`;
}

function getCellsBetween(start: number, end: number) {
	return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getBoundsSize(bounds: Bounds) {
	return {
		rows: bounds.maxRow - bounds.minRow + 1,
		cols: bounds.maxCol - bounds.minCol + 1,
	};
}

function getWinningLine(
	board: Board,
	row: number,
	col: number,
	player: Player,
	winLength: number,
): string[] | null {
	for (const [rowDir, colDir] of DIRECTIONS) {
		const line: string[] = [keyOf(row, col)];

		for (const sign of [-1, 1] as const) {
			let nextRow = row + rowDir * sign;
			let nextCol = col + colDir * sign;
			const segment: string[] = [];

			while (board[keyOf(nextRow, nextCol)] === player) {
				segment.push(keyOf(nextRow, nextCol));
				nextRow += rowDir * sign;
				nextCol += colDir * sign;
			}

			if (sign === -1) {
				line.unshift(...segment);
			} else {
				line.push(...segment);
			}
		}

		if (line.length >= winLength) return line;
	}

	return null;
}

function expandBounds(
	bounds: Bounds,
	row: number,
	col: number,
	mode: BoardMode,
): Bounds {
	if (mode === "classic") return bounds;

	const next = { ...bounds };
	const { rows, cols } = getBoundsSize(bounds);

	if (row === bounds.minRow && rows < GROWING_MAX_SIZE) next.minRow -= 1;
	if (row === bounds.maxRow && rows < GROWING_MAX_SIZE) next.maxRow += 1;
	if (col === bounds.minCol && cols < GROWING_MAX_SIZE) next.minCol -= 1;
	if (col === bounds.maxCol && cols < GROWING_MAX_SIZE) next.maxCol += 1;

	return next;
}

function isBoardFull(board: Board, bounds: Bounds, mode: BoardMode) {
	const { rows, cols } = getBoundsSize(bounds);
	if (mode === "classic") return Object.keys(board).length >= rows * cols;

	return (
		rows === GROWING_MAX_SIZE &&
		cols === GROWING_MAX_SIZE &&
		Object.keys(board).length >= rows * cols
	);
}

export default function DuelTicTacToeGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [boardMode, setBoardMode] = useState<BoardMode>("classic");
	const [board, setBoard] = useState<Board>({});
	const [bounds, setBounds] = useState<Bounds>(() =>
		createInitialBounds("classic"),
	);
	const [currentPlayer, setCurrentPlayer] = useState<Player>("X");
	const [winsX, setWinsX] = useState(0);
	const [winsO, setWinsO] = useState(0);
	const [draws, setDraws] = useState(0);
	const [targetWins, setTargetWins] = useState(2);
	const [matchWinner, setMatchWinner] = useState<Player | null>(null);
	const [roundWinner, setRoundWinner] = useState<Winner>(null);
	const [winningLine, setWinningLine] = useState<string[]>([]);

	const { rows, cols } = getBoundsSize(bounds);
	const rowIndexes = getCellsBetween(bounds.minRow, bounds.maxRow);
	const colIndexes = getCellsBetween(bounds.minCol, bounds.maxCol);
	const cellSize =
		boardMode === "classic" ? CLASSIC_CELL_SIZE : GROWING_CELL_SIZE;
	const winLength =
		boardMode === "classic" ? CLASSIC_WIN_LENGTH : GROWING_WIN_LENGTH;
	const modeLabel = boardMode === "classic" ? "3x3" : `5+ | ${rows}x${cols}`;

	const handlePress = (row: number, col: number) => {
		const cellKey = keyOf(row, col);
		if (board[cellKey] || roundWinner !== null || matchWinner !== null) {
			return;
		}
		haptic.tap();

		const next = { ...board, [cellKey]: currentPlayer };
		const nextBounds = expandBounds(bounds, row, col, boardMode);
		setBoard(next);
		setBounds(nextBounds);

		const line = getWinningLine(next, row, col, currentPlayer, winLength);
		if (line && currentPlayer === "X") {
			const nw = winsX + 1;
			setWinsX(nw);
			setRoundWinner("X");
			setWinningLine(line);
			updateProgress("duel-tictactoe", nw);
			if (nw >= targetWins) {
				haptic.heavy();
				setMatchWinner("X");
			}
			return;
		}
		if (line && currentPlayer === "O") {
			const nw = winsO + 1;
			setWinsO(nw);
			setRoundWinner("O");
			setWinningLine(line);
			updateProgress("duel-tictactoe", nw);
			if (nw >= targetWins) {
				haptic.heavy();
				setMatchWinner("O");
			}
			return;
		}
		if (isBoardFull(next, nextBounds, boardMode)) {
			setRoundWinner("draw");
			setDraws((p) => p + 1);
			return;
		}
		setCurrentPlayer((prev) => (prev === "X" ? "O" : "X"));
	};

	const resetBoard = (mode = boardMode) => {
		setBoard({});
		setBounds(createInitialBounds(mode));
		setCurrentPlayer("X");
		setRoundWinner(null);
		setWinningLine([]);
	};
	const resetMatch = (mode = boardMode) => {
		setBoard({});
		setBounds(createInitialBounds(mode));
		setCurrentPlayer("X");
		setWinsX(0);
		setWinsO(0);
		setDraws(0);
		setMatchWinner(null);
		setRoundWinner(null);
		setWinningLine([]);
	};
	const changeBoardMode = (mode: BoardMode) => {
		setBoardMode(mode);
		resetMatch(mode);
	};

	const roundOver = roundWinner !== null;
	const statusText = matchWinner
		? t("tttMatchWin", { player: matchWinner })
		: roundWinner === null
			? t("tttTurn", { player: currentPlayer })
			: roundWinner === "draw"
				? t("tttDraw")
				: t("tttRoundWin", { player: roundWinner });

	const statusColor = matchWinner
		? theme.tint
		: roundWinner === "draw"
			? theme.mutedText
			: roundWinner !== null
				? theme.tint
				: theme.text;

	return (
		<View style={styles.root}>
			{/* ── Score strip ── */}
			<View style={styles.scoreStrip}>
				<View style={styles.scoreBlock}>
					<Text style={[styles.scoreName, { color: theme.mutedText }]}>
						{t("tttPlayerX")}
					</Text>
					<Text
						style={[
							styles.scoreNum,
							{
								color:
									currentPlayer === "X" && !roundOver ? theme.tint : theme.text,
							},
						]}
					>
						{winsX}
					</Text>
				</View>
				<View style={styles.divider}>
					<Text style={[styles.drawCount, { color: theme.mutedText }]}>
						{t("tttDrawCount", { count: draws })}
					</Text>
				</View>
				<View style={[styles.scoreBlock, styles.scoreRight]}>
					<Text style={[styles.scoreName, { color: theme.mutedText }]}>
						{t("tttPlayerO")}
					</Text>
					<Text
						style={[
							styles.scoreNum,
							{
								color:
									currentPlayer === "O" && !roundOver ? theme.tint : theme.text,
							},
						]}
					>
						{winsO}
					</Text>
				</View>
			</View>

			{/* ── Mode chips ── */}
			<View style={styles.modeRow}>
				{(["classic", "growing"] as const).map((mode) => (
					<Pressable
						key={mode}
						style={[
							styles.modeChip,
							{
								borderColor: theme.border,
								backgroundColor: boardMode === mode ? theme.tint : theme.card,
							},
						]}
						onPress={() => changeBoardMode(mode)}
					>
						<Text
							style={[
								styles.modeText,
								{ color: boardMode === mode ? "#fff" : theme.mutedText },
							]}
						>
							{mode === "classic" ? "3x3" : "5+"}
						</Text>
					</Pressable>
				))}
			</View>

			<View style={styles.modeRow}>
				{([2, 3] as const).map((tw) => (
					<Pressable
						key={tw}
						style={[
							styles.modeChip,
							{
								borderColor: theme.border,
								backgroundColor: targetWins === tw ? theme.tint : theme.card,
							},
						]}
						onPress={() => {
							setTargetWins(tw);
							resetMatch();
						}}
					>
						<Text
							style={[
								styles.modeText,
								{ color: targetWins === tw ? "#fff" : theme.mutedText },
							]}
						>
							{tw === 2 ? t("tttBestOf3") : t("tttBestOf5")}
						</Text>
					</Pressable>
				))}
			</View>

			{/* ── Status ── */}
			<View style={styles.statusRow}>
				<Text style={[styles.status, { color: statusColor }]}>
					{statusText}
				</Text>
				<Text style={[styles.boardSize, { color: theme.mutedText }]}>
					{modeLabel}
				</Text>
			</View>

			{/* ── Board ── */}
			<ScrollView
				style={[styles.boardViewport, { borderColor: theme.border }]}
				contentContainerStyle={styles.boardViewportContent}
				showsVerticalScrollIndicator={false}
			>
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View
						style={[
							styles.board,
							{
								width: cols * cellSize + (cols - 1) * BOARD_GAP,
							},
						]}
					>
						{rowIndexes.map((row) =>
							colIndexes.map((col) => {
								const cellKey = keyOf(row, col);
								const value: CellValue = board[cellKey] ?? null;
								const isX = value === "X";
								const isO = value === "O";
								const isWinCell = winningLine.includes(cellKey);
								const cellBg = isWinCell
									? theme.tint
									: isX
										? theme.accentSoft
										: isO
											? theme.card
											: theme.elevated;
								const cellBorder = isWinCell
									? theme.tint
									: isX
										? theme.tint
										: theme.border;
								const textColor = isWinCell
									? "#fff"
									: isX
										? theme.tint
										: isO
											? theme.mutedText
											: "transparent";
								return (
									<Pressable
										key={cellKey}
										style={[
											styles.cell,
											{
												backgroundColor: cellBg,
												borderColor: cellBorder,
												width: cellSize,
												height: cellSize,
											},
											isWinCell && styles.cellWin,
										]}
										onPress={() => handlePress(row, col)}
									>
										<Text
											style={[
												styles.cellText,
												{ color: textColor, fontSize: cellSize * 0.44 },
											]}
										>
											{value ?? "·"}
										</Text>
									</Pressable>
								);
							}),
						)}
					</View>
				</ScrollView>
			</ScrollView>

			{/* ── Action button ── */}
			<Pressable
				style={[
					styles.actionBtn,
					{
						backgroundColor: matchWinner ? theme.tint : theme.card,
						borderColor: matchWinner ? theme.tint : theme.border,
					},
				]}
				onPress={() => {
					if (matchWinner) {
						resetMatch();
					} else {
						resetBoard();
					}
				}}
			>
				<Text
					style={[
						styles.actionText,
						{ color: matchWinner ? "#fff" : theme.text },
					]}
				>
					{matchWinner
						? t("tttNewMatch")
						: roundOver
							? t("tttNextRound")
							: t("tttRestart")}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, paddingHorizontal: BOARD_PADDING, paddingTop: 12, gap: 14 },
	/* ── Score ── */
	scoreStrip: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	scoreBlock: { alignItems: "flex-start" },
	scoreRight: { alignItems: "flex-end" },
	scoreName: {
		fontSize: 11,
		fontWeight: "700",
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	scoreNum: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
	divider: { alignItems: "center" },
	drawCount: { fontSize: 12, fontWeight: "600" },
	/* ── Mode ── */
	modeRow: { flexDirection: "row", gap: 8 },
	modeChip: {
		borderWidth: 1,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 7,
	},
	modeText: { fontSize: 13, fontWeight: "700" },
	/* ── Status ── */
	statusRow: { gap: 3 },
	status: { fontSize: 16, fontWeight: "700" },
	boardSize: { fontSize: 12, fontWeight: "700" },
	/* ── Board ── */
	boardViewport: {
		maxHeight: 390,
		borderWidth: 1,
		borderRadius: 18,
	},
	boardViewportContent: { padding: 10 },
	board: { flexDirection: "row", flexWrap: "wrap", gap: BOARD_GAP },
	cell: {
		borderWidth: 1.5,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	cellText: { fontWeight: "900" },
	cellWin: { borderWidth: 3, transform: [{ scale: 1.06 }] },
	/* ── Action ── */
	actionBtn: {
		borderWidth: 1.5,
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: "center",
	},
	actionText: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
});
