import { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";

const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_GAP = 10;
const BOARD_PADDING = 20;
const CELL_SIZE = (SCREEN_W - BOARD_PADDING * 2 - BOARD_GAP * 2) / 3;

type CellValue = "X" | "O" | null;
type Winner = "X" | "O" | "draw" | null;

const LINES: number[][] = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6],
];

const CELL_KEYS = [
	"c0",
	"c1",
	"c2",
	"c3",
	"c4",
	"c5",
	"c6",
	"c7",
	"c8",
] as const;

function getWinner(board: CellValue[]): Winner {
	for (const [a, b, c] of LINES) {
		if (board[a] && board[a] === board[b] && board[a] === board[c])
			return board[a];
	}
	if (board.every((item) => item !== null)) return "draw";
	return null;
}

export default function DuelTicTacToeGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();

	const [board, setBoard] = useState<CellValue[]>(Array(9).fill(null));
	const [currentPlayer, setCurrentPlayer] = useState<"X" | "O">("X");
	const [winsX, setWinsX] = useState(0);
	const [winsO, setWinsO] = useState(0);
	const [draws, setDraws] = useState(0);
	const [targetWins, setTargetWins] = useState(2);
	const [matchWinner, setMatchWinner] = useState<"X" | "O" | null>(null);

	const winner = useMemo(() => getWinner(board), [board]);
	const winningLine = useMemo(() => {
		for (const line of LINES) {
			const [a, b, c] = line;
			if (board[a] && board[a] === board[b] && board[a] === board[c])
				return line;
		}
		return null;
	}, [board]);

	const handlePress = (index: number) => {
		if (board[index] !== null || winner !== null || matchWinner !== null)
			return;

		const next = [...board];
		next[index] = currentPlayer;
		setBoard(next);

		const resolved = getWinner(next);
		if (resolved === "X") {
			const nw = winsX + 1;
			setWinsX(nw);
			updateProgress("duel-tictactoe", nw);
			if (nw >= targetWins) setMatchWinner("X");
			return;
		}
		if (resolved === "O") {
			const nw = winsO + 1;
			setWinsO(nw);
			updateProgress("duel-tictactoe", nw);
			if (nw >= targetWins) setMatchWinner("O");
			return;
		}
		if (resolved === "draw") {
			setDraws((p) => p + 1);
			return;
		}
		setCurrentPlayer((prev) => (prev === "X" ? "O" : "X"));
	};

	const resetBoard = () => {
		setBoard(Array(9).fill(null));
		setCurrentPlayer("X");
	};
	const resetMatch = () => {
		setBoard(Array(9).fill(null));
		setCurrentPlayer("X");
		setWinsX(0);
		setWinsO(0);
		setDraws(0);
		setMatchWinner(null);
	};

	const roundOver = winner !== null;
	const statusText = matchWinner
		? t("tttMatchWin", { player: matchWinner })
		: winner === null
			? t("tttTurn", { player: currentPlayer })
			: winner === "draw"
				? t("tttDraw")
				: t("tttRoundWin", { player: winner });

	const statusColor = matchWinner
		? theme.tint
		: winner === "draw"
			? theme.mutedText
			: winner !== null
				? theme.tint
				: theme.text;

	return (
		<View style={styles.root}>
			{/* ── Score strip ── */}
			<View style={styles.scoreStrip}>
				<View style={styles.scoreBlock}>
					<Text style={[styles.scoreName, { color: theme.mutedText }]}>
						Player X
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
			<Text style={[styles.status, { color: statusColor }]}>{statusText}</Text>

			{/* ── Board ── */}
			<View style={styles.board}>
				{board.map((value, index) => {
					const isX = value === "X";
					const isO = value === "O";
					const isWinCell = winningLine?.includes(index) ?? false;
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
							key={CELL_KEYS[index]}
							style={[
								styles.cell,
								{ backgroundColor: cellBg, borderColor: cellBorder },
								isWinCell && styles.cellWin,
							]}
							onPress={() => handlePress(index)}
						>
							<Text style={[styles.cellText, { color: textColor }]}>
								{value ?? "·"}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{/* ── Action button ── */}
			<Pressable
				style={[
					styles.actionBtn,
					{
						backgroundColor: matchWinner ? theme.tint : theme.card,
						borderColor: matchWinner ? theme.tint : theme.border,
					},
				]}
				onPress={matchWinner ? resetMatch : resetBoard}
			>
				<Text
					style={[
						styles.actionText,
						{ color: matchWinner ? "#fff" : theme.text },
					]}
				>
					{matchWinner ? t("tttNewMatch") : roundOver ? t("tttNextRound") : t("tttRestart")}
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
	status: { fontSize: 16, fontWeight: "700" },
	/* ── Board ── */
	board: { flexDirection: "row", flexWrap: "wrap", gap: BOARD_GAP },
	cell: {
		width: CELL_SIZE,
		height: CELL_SIZE,
		borderWidth: 1.5,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	cellText: { fontSize: CELL_SIZE * 0.44, fontWeight: "900" },
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
