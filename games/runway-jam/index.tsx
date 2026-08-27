import { useState } from "react";
import {
	Pressable,
	View as RNView,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { LEVELS } from "@/games/runway-jam/levels";
import {
	GRID_SIZE,
	PLANE_ID,
	type Move,
	type Piece,
	applyMove,
	buildGrid,
	isSolved,
	nextOptimalMove,
} from "@/games/runway-jam/logic";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

// Stable fallback: returning a fresh `{}` from a Zustand selector makes
// getSnapshot produce a new reference every call, which loops React's
// useSyncExternalStore until it throws on first open (no progress entry yet).
const EMPTY_LEVEL_STARS: Record<string, number> = {};

/* ================================================================
   CONSTANTS
   ================================================================ */

const CELL_GAP = 4;
const BOARD_PADDING = 8;
const STAR_FACTOR = 1.5; // ≤ ceil(minMoves * 1.5) → 2★

/** Vehicle colors (mod palette, plane excluded — it uses the theme tint). */
const VEHICLE_COLORS = [
	"#ffa726",
	"#66bb6a",
	"#ab47bc",
	"#26c6da",
	"#ec407a",
	"#8d6e63",
	"#78909c",
	"#d4e157",
	"#7e57c2",
	"#ef5350",
	"#29b6f6",
];

function vehicleColor(id: number): string {
	return VEHICLE_COLORS[(id - 1) % VEHICLE_COLORS.length];
}

function vehicleEmoji(piece: Piece): string {
	return piece.len === 3 ? "⛽" : "🧳";
}

function getStars(moves: number, minMoves: number): number {
	if (moves <= minMoves) return 3;
	if (moves <= Math.ceil(minMoves * STAR_FACTOR)) return 2;
	return 1;
}

/** Star rule with hints: using any hint caps the result at 2★. */
function getFinalStars(
	moves: number,
	minMoves: number,
	hintsUsed: number,
): number {
	const stars = getStars(moves, minMoves);
	return hintsUsed > 0 ? Math.min(stars, 2) : stars;
}

/* ================================================================
   STAR DISPLAY
   ================================================================ */

function Stars({ count, size = 26 }: { count: number; size?: number }) {
	return (
		<RNView style={{ flexDirection: "row", gap: 4, marginVertical: 4 }}>
			{[1, 2, 3].map((i) => (
				<Text key={i} style={{ fontSize: size, opacity: i <= count ? 1 : 0.2 }}>
					⭐
				</Text>
			))}
		</RNView>
	);
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function RunwayJamGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);
	const levelStars =
		useGameStore((s) => s.progress["runway-jam"]?.levelStars) ??
		EMPTY_LEVEL_STARS;
	const { width: screenW } = useWindowDimensions();

	const [phase, setPhase] = useState<"menu" | "playing" | "won">("menu");
	const [levelIdx, setLevelIdx] = useState(0);
	const [pieces, setPieces] = useState<Piece[]>([]);
	const [moves, setMoves] = useState(0);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [hintsUsed, setHintsUsed] = useState(0);
	const [hintMove, setHintMove] = useState<Move | null>(null);

	const level = LEVELS[levelIdx];

	/* --- derived layout --- */
	const boardSize = Math.min(screenW - 32, 360);
	const cellSize = Math.floor(
		(boardSize - BOARD_PADDING * 2 - CELL_GAP * (GRID_SIZE - 1)) / GRID_SIZE,
	);
	const cellStep = cellSize + CELL_GAP;

	/* --- flow --- */
	const startLevel = (idx: number) => {
		setLevelIdx(idx);
		setPieces(LEVELS[idx].pieces.map((p) => ({ ...p })));
		setMoves(0);
		setSelectedId(null);
		setHintsUsed(0);
		setHintMove(null);
		setPhase("playing");
	};

	const finishMove = (next: Piece[]) => {
		const nextMoves = moves + 1;
		setPieces(next);
		setMoves(nextMoves);
		setSelectedId(null);
		setHintMove(null);

		if (isSolved(next)) {
			haptic.success();
			const stars = getFinalStars(nextMoves, level.minMoves, hintsUsed);
			updateProgress("runway-jam", stars, {
				won: true,
				levelStarsPatch: { [String(level.id)]: stars },
			});
			setPhase("won");
		} else {
			haptic.tap();
		}
	};

	/* --- interaction --- */
	const handlePiecePress = (id: number) => {
		if (phase !== "playing") return;
		haptic.tap();
		setSelectedId((prev) => (prev === id ? null : id));
	};

	const handleHintPress = () => {
		if (phase !== "playing") return;
		const move = nextOptimalMove(pieces);
		if (!move) return;
		haptic.tap();
		setHintMove(move);
		setHintsUsed((prev) => prev + 1);
	};

	/**
	 * Forgiving slide: the selected piece moves toward the tapped cell along
	 * its axis, as far as it can, stopping when its leading edge reaches the
	 * tapped cell or an obstacle.
	 */
	const handleCellPress = (row: number, col: number) => {
		if (phase !== "playing" || selectedId === null) return;
		const piece = pieces.find((p) => p.id === selectedId);
		if (!piece) return;
		const grid = buildGrid(pieces);

		if (piece.horiz) {
			if (row !== piece.row) return;
			let target = piece.col;
			if (col > piece.col + piece.len - 1) {
				while (
					target + piece.len < GRID_SIZE &&
					grid[row][target + piece.len] === -1 &&
					target + piece.len - 1 < col
				) {
					target++;
				}
			} else if (col < piece.col) {
				while (target > 0 && grid[row][target - 1] === -1 && target > col) {
					target--;
				}
			}
			if (target === piece.col) return;
			finishMove(applyMove(pieces, piece.id, row, target));
		} else {
			if (col !== piece.col) return;
			let target = piece.row;
			if (row > piece.row + piece.len - 1) {
				while (
					target + piece.len < GRID_SIZE &&
					grid[target + piece.len][col] === -1 &&
					target + piece.len - 1 < row
				) {
					target++;
				}
			} else if (row < piece.row) {
				while (target > 0 && grid[target - 1][col] === -1 && target > row) {
					target--;
				}
			}
			if (target === piece.row) return;
			finishMove(applyMove(pieces, piece.id, target, col));
		}
	};

	/* --- highlight cells the selected piece can slide into --- */
	const highlighted = new Set<number>();
	if (phase === "playing" && selectedId !== null) {
		const piece = pieces.find((p) => p.id === selectedId);
		if (piece) {
			const grid = buildGrid(pieces);
			if (piece.horiz) {
				for (let c = piece.col - 1; c >= 0 && grid[piece.row][c] === -1; c--) {
					highlighted.add(piece.row * GRID_SIZE + c);
				}
				for (
					let c = piece.col + piece.len;
					c < GRID_SIZE && grid[piece.row][c] === -1;
					c++
				) {
					highlighted.add(piece.row * GRID_SIZE + c);
				}
			} else {
				for (let r = piece.row - 1; r >= 0 && grid[r][piece.col] === -1; r--) {
					highlighted.add(r * GRID_SIZE + piece.col);
				}
				for (
					let r = piece.row + piece.len;
					r < GRID_SIZE && grid[r][piece.col] === -1;
					r++
				) {
					highlighted.add(r * GRID_SIZE + piece.col);
				}
			}
		}
	}

	/* ================================================================
	   RENDER — MENU
	   ================================================================ */

	if (phase === "menu") {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("gameRunwayJamName")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("gameRunwayJamDescription")}
				</Text>
				<Text style={[s.hint, { color: theme.mutedText }]}>
					{t("gameTapToStart")}
				</Text>

				<Text style={[s.levelLabel, { color: theme.mutedText }]}>
					{t("selectLevel")}
				</Text>
				<ScrollView
					contentContainerStyle={s.levelGrid}
					style={{ maxHeight: 300 }}
				>
					{LEVELS.map((lvl, i) => (
						<Pressable
							key={lvl.id}
							style={[
								s.levelBtn,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => startLevel(i)}
							accessibilityRole="button"
							accessibilityLabel={t("levelLabel", { level: lvl.id })}
						>
							<Text style={[s.levelBtnText, { color: theme.text }]}>
								{lvl.id}
							</Text>
							<Stars count={levelStars[String(lvl.id)] ?? 0} size={10} />
							<Text style={{ fontSize: 8, color: theme.mutedText }}>
								{lvl.minMoves}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			</View>
		);
	}

	/* ================================================================
	   RENDER — PLAYING / WON
	   ================================================================ */

	const stars = getFinalStars(moves, level.minMoves, hintsUsed);
	const exitTop = BOARD_PADDING + 2 * cellStep + cellSize / 2 - 12;
	const hintCellKey =
		hintMove !== null ? hintMove.row * GRID_SIZE + hintMove.col : null;

	return (
		<View style={s.root}>
			{/* HUD */}
			<RNView style={s.hud}>
				<Text style={[s.hudText, { color: theme.mutedText }]}>
					{t("levelLabel", { level: level.id })}
				</Text>
				<Text style={[s.hudText, { color: theme.text }]}>
					{t("moves", { count: moves })}
				</Text>
				<Text style={[s.hudText, { color: theme.tint }]}>
					{t("rjamTarget", { count: level.minMoves })}
				</Text>
				<Pressable
					style={[
						s.hintBtn,
						{ borderColor: theme.tint, opacity: phase !== "playing" ? 0.4 : 1 },
					]}
					onPress={handleHintPress}
					disabled={phase !== "playing"}
					accessibilityRole="button"
					accessibilityLabel={t("hint")}
					accessibilityState={{ disabled: phase !== "playing" }}
				>
					<Text style={[s.hintBtnText, { color: theme.tint }]}>
						💡 {t("hint")}
					</Text>
				</Pressable>
			</RNView>

			{/* Board */}
			<RNView
				style={[
					s.board,
					{
						width: boardSize,
						height: boardSize,
						backgroundColor: theme.card,
						borderColor: theme.border,
					},
				]}
			>
				{/* Background cells (tap targets) */}
				{Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => {
					const row = Math.floor(i / GRID_SIZE);
					const col = i % GRID_SIZE;
					const lit = highlighted.has(i);
					const hinted = hintCellKey === i;
					return (
						<Pressable
							key={`cell-${row}-${col}`}
							onPress={() => handleCellPress(row, col)}
							accessibilityLabel={t("a11yRowCol", { row: row + 1, col: col + 1 })}
							style={{
								position: "absolute",
								left: BOARD_PADDING + col * cellStep,
								top: BOARD_PADDING + row * cellStep,
								width: cellSize,
								height: cellSize,
								borderRadius: 6,
								backgroundColor: hinted
									? theme.tint + "55"
									: lit
										? theme.accentSoft
										: theme.surface,
								borderWidth: hinted ? 2 : lit ? 1.5 : 0,
								borderColor: theme.tint,
								borderStyle: hinted ? "dashed" : "solid",
							}}
						/>
					);
				})}

				{/* Pieces */}
				{pieces.map((piece) => {
					const isPlane = piece.id === PLANE_ID;
					const selected = selectedId === piece.id;
					const hinted = hintMove !== null && hintMove.id === piece.id;
					const w = piece.horiz
						? piece.len * cellSize + (piece.len - 1) * CELL_GAP
						: cellSize;
					const h = piece.horiz
						? cellSize
						: piece.len * cellSize + (piece.len - 1) * CELL_GAP;
					const color = isPlane ? theme.tint : vehicleColor(piece.id);
					return (
						<Pressable
							key={`piece-${piece.id}`}
							onPress={() => handlePiecePress(piece.id)}
							accessibilityRole="button"
							accessibilityLabel={
								isPlane
									? t("rjamA11yPlane")
									: t("rjamA11yVehicle", { id: piece.id })
							}
							accessibilityState={{ selected }}
							style={{
								position: "absolute",
								left: BOARD_PADDING + piece.col * cellStep,
								top: BOARD_PADDING + piece.row * cellStep,
								width: w,
								height: h,
								borderRadius: 8,
								backgroundColor: color + (isPlane ? "" : "cc"),
								borderWidth: hinted ? 3 : selected ? 3 : 1.5,
								borderColor: hinted
									? theme.tint
									: selected
										? theme.text
										: color,
								borderStyle: hinted ? "dashed" : "solid",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<Text style={{ fontSize: Math.min(24, cellSize * 0.55) }}>
								{isPlane ? "✈️" : vehicleEmoji(piece)}
							</Text>
						</Pressable>
					);
				})}

				{/* Exit marker on the right edge of row 2 */}
				<RNView
					style={[s.exitMarker, { top: exitTop }]}
					accessibilityLabel="Exit"
				>
					<Text style={{ fontSize: 18, color: theme.tint }}>➤</Text>
				</RNView>
			</RNView>

			{/* Bottom bar */}
			<RNView style={s.bottomBar}>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => startLevel(levelIdx)}
					accessibilityRole="button"
					accessibilityLabel={t("playAgain")}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>
						{t("playAgain")}
					</Text>
				</Pressable>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => setPhase("menu")}
					accessibilityRole="button"
					accessibilityLabel={t("selectLevel")}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>
						{t("selectLevel")}
					</Text>
				</Pressable>
			</RNView>

			{/* Solved overlay */}
			{phase === "won" && (
				<RNView style={s.overlay}>
					<RNView
						style={[
							s.overlayCard,
							{ backgroundColor: theme.elevated, borderColor: theme.border },
						]}
					>
						<Text style={[s.overlayTitle, { color: theme.text }]}>
							{t("rjamSolved")}
						</Text>
						<Stars count={stars} />
						<Text style={[s.overlayMoves, { color: theme.mutedText }]}>
							{t("moves", { count: moves })} ·{" "}
							{t("rjamTarget", { count: level.minMoves })}
						</Text>
						<RNView style={s.btnCol}>
							{levelIdx < LEVELS.length - 1 && (
								<Pressable
									style={[s.mainBtn, { backgroundColor: theme.tint }]}
									onPress={() => startLevel(levelIdx + 1)}
									accessibilityRole="button"
									accessibilityLabel={t("nextLevel")}
								>
									<Text style={[s.mainBtnText, { color: theme.onTint }]}>
										{t("nextLevel")}
									</Text>
								</Pressable>
							)}
							<Pressable
								style={[
									s.mainBtn,
									{
										backgroundColor: theme.surface,
										borderWidth: 1,
										borderColor: theme.border,
									},
								]}
								onPress={() => startLevel(levelIdx)}
								accessibilityRole="button"
								accessibilityLabel={t("playAgain")}
							>
								<Text style={[s.mainBtnText, { color: theme.text }]}>
									{t("playAgain")}
								</Text>
							</Pressable>
							<Pressable
								style={[
									s.mainBtn,
									{
										backgroundColor: theme.surface,
										borderWidth: 1,
										borderColor: theme.border,
									},
								]}
								onPress={() => setPhase("menu")}
								accessibilityRole="button"
								accessibilityLabel={t("selectLevel")}
							>
								<Text style={[s.mainBtnText, { color: theme.text }]}>
									{t("selectLevel")}
								</Text>
							</Pressable>
						</RNView>
					</RNView>
				</RNView>
			)}
		</View>
	);
}

/* ================================================================
   STYLES
   ================================================================ */

const s = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 16,
	},
	title: { fontSize: 28, fontWeight: "900", marginBottom: 6 },
	desc: {
		fontSize: 13,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: 6,
	},
	hint: { fontSize: 12, textAlign: "center", marginBottom: 14 },
	levelLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		marginBottom: 6,
	},
	levelGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		paddingBottom: 16,
	},
	levelBtn: {
		width: 60,
		height: 60,
		borderRadius: 10,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	levelBtnText: { fontSize: 18, fontWeight: "800" },

	hud: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
		paddingHorizontal: 4,
		marginBottom: 12,
	},
	hudText: { fontSize: 13, fontWeight: "700" },
	hintBtn: {
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 8,
		borderWidth: 1.5,
	},
	hintBtnText: { fontSize: 12, fontWeight: "700" },

	board: {
		borderRadius: 14,
		borderWidth: 1.5,
	},
	exitMarker: {
		position: "absolute",
		right: -14,
		width: 24,
		height: 24,
		alignItems: "center",
		justifyContent: "center",
	},

	bottomBar: {
		flexDirection: "row",
		gap: 12,
		marginTop: 16,
	},
	smallBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
	},
	smallBtnText: { fontSize: 13, fontWeight: "600" },

	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0,0,0,0.55)",
		alignItems: "center",
		justifyContent: "center",
	},
	overlayCard: {
		borderRadius: 16,
		borderWidth: 1.5,
		paddingVertical: 24,
		paddingHorizontal: 32,
		alignItems: "center",
		minWidth: 240,
	},
	overlayTitle: { fontSize: 22, fontWeight: "900", marginBottom: 4 },
	overlayMoves: { fontSize: 13, marginBottom: 12 },
	btnCol: { gap: 8, alignItems: "stretch", alignSelf: "stretch" },
	mainBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 12,
		alignItems: "center",
	},
	mainBtnText: { fontWeight: "800", fontSize: 15 },
});
