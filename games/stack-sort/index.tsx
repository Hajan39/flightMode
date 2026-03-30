import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
	StyleSheet,
	Pressable,
	Animated,
	Easing,
	ScrollView,
	View as RNView,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_STACK = 4;

/** Level definitions: [numCount, columnCount, emptyColumns] */
const LEVELS: [number, number, number][] = [
	/* 1  */ [6, 4, 1],
	/* 2  */ [8, 5, 1],
	/* 3  */ [10, 5, 1],
	/* 4  */ [10, 6, 2],
	/* 5  */ [12, 6, 1],
	/* 6  */ [14, 6, 1],
	/* 7  */ [14, 7, 2],
	/* 8  */ [16, 7, 1],
	/* 9  */ [16, 7, 2],
	/* 10 */ [18, 7, 1],
	/* 11 */ [20, 8, 2],
	/* 12 */ [20, 8, 1],
	/* 13 */ [24, 9, 2],
	/* 14 */ [24, 9, 1],
	/* 15 */ [28, 10, 2],
	/* 16 */ [28, 10, 1],
	/* 17 */ [30, 10, 1],
	/* 18 */ [32, 10, 1],
	/* 19 */ [32, 11, 2],
	/* 20 */ [36, 11, 1],
];

const STAR_THRESHOLDS = [1.5, 2.5]; // multiplier of numCount → 3★, 2★

/* ================================================================
   COLORS per number (mod 12 palette, vibrant)
   ================================================================ */

const TILE_COLORS = [
	"#ef5350", // 1  red
	"#42a5f5", // 2  blue
	"#66bb6a", // 3  green
	"#ffa726", // 4  orange
	"#ab47bc", // 5  purple
	"#26c6da", // 6  cyan
	"#ec407a", // 7  pink
	"#8d6e63", // 8  brown
	"#78909c", // 9  blue-grey
	"#d4e157", // 10 lime
	"#7e57c2", // 11 deep purple
	"#29b6f6", // 12 light blue
];

function tileColor(n: number): string {
	return TILE_COLORS[(n - 1) % TILE_COLORS.length];
}

/* ================================================================
   SOLVABLE LEVEL GENERATOR
   ================================================================ */

/**
 * Generate a solvable puzzle by reverse-simulation:
 * Start from solved state and make random valid reverse moves.
 */
function generateLevel(
	numCount: number,
	columnCount: number,
	emptyColumns: number,
	seed?: number,
): number[][] {
	// The "goal" has all numbers. We distribute them into columns.
	// Approach: place numbers 1..numCount sequentially into random columns
	// using reverse logic (pull from goal, place randomly obeying stack rules reversed).
	//
	// Simpler reliable approach: do a shuffled deal then verify solvability
	// via reverse-construction:
	//
	// 1. Start with numbers [numCount, numCount-1, ..., 1] (goal feeds them out in reverse)
	// 2. Place each number into a random valid column (top must be < current number, or empty)
	// 3. This guarantees the puzzle is solvable (you can just reverse the placement)

	const cols: number[][] = [];
	const usable = columnCount - emptyColumns; // columns that get numbers
	for (let i = 0; i < columnCount; i++) cols.push([]);

	// Simple seeded RNG
	let s = seed ?? (Date.now() ^ (Math.random() * 0xffffffff));
	const rng = () => {
		s = (s * 1664525 + 1013904223) & 0x7fffffff;
		return s / 0x7fffffff;
	};

	// Place numbers from numCount down to 1
	// Rule: column.length < MAX_STACK and (empty or top > number)
	// (This mirrors the forward rule: you can move X onto Y if Y > X)
	for (let num = numCount; num >= 1; num--) {
		// Collect valid target columns (only the first `usable` columns for initial deal)
		const candidates: number[] = [];
		for (let c = 0; c < usable; c++) {
			if (cols[c].length >= MAX_STACK) continue;
			if (cols[c].length === 0 || cols[c][cols[c].length - 1] > num) {
				candidates.push(c);
			}
		}
		if (candidates.length === 0) {
			// Shouldn't happen with well-tuned params, but fallback: use any column with space
			for (let c = 0; c < usable; c++) {
				if (cols[c].length < MAX_STACK) {
					candidates.push(c);
					break;
				}
			}
		}
		const ci = candidates[Math.floor(rng() * candidates.length)];
		cols[ci].push(num);
	}

	// Shuffle column order (keep empty columns at end)
	const filled = cols.slice(0, usable);
	// Fisher-Yates on filled
	for (let i = filled.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[filled[i], filled[j]] = [filled[j], filled[i]];
	}
	const result = [...filled];
	for (let i = 0; i < emptyColumns; i++) result.push([]);
	return result;
}

/* ================================================================
   DEADLOCK DETECTION
   ================================================================ */

function isDeadlocked(columns: number[][], goal: number[], numCount: number): boolean {
	const nextGoal = goal.length + 1;
	for (let i = 0; i < columns.length; i++) {
		const col = columns[i];
		if (col.length === 0) return false; // empty column exists → not deadlocked
		const top = col[col.length - 1];
		// Can put into goal?
		if (top === nextGoal) return false;
		// Can move to any other column?
		for (let j = 0; j < columns.length; j++) {
			if (i === j) continue;
			if (columns[j].length >= MAX_STACK) continue;
			if (columns[j].length === 0) return false;
			if (columns[j][columns[j].length - 1] > top) return false;
		}
	}
	return true;
}

/* ================================================================
   ANIMATED TILE
   ================================================================ */

function Tile({
	value,
	selected,
	isGoal,
	width,
}: {
	value: number;
	selected?: boolean;
	isGoal?: boolean;
	width: number;
}) {
	const scale = useRef(new Animated.Value(1)).current;
	const bg = isGoal ? "rgba(255,215,0,0.18)" : tileColor(value) + "22";
	const border = isGoal ? "#ffd700" : tileColor(value);
	const textColor = isGoal ? "#ffd700" : tileColor(value);

	useEffect(() => {
		if (selected) {
			Animated.sequence([
				Animated.timing(scale, {
					toValue: 1.12,
					duration: 120,
					easing: Easing.out(Easing.back(2)),
					useNativeDriver: true,
				}),
			]).start();
		} else {
			Animated.timing(scale, {
				toValue: 1,
				duration: 100,
				useNativeDriver: true,
			}).start();
		}
	}, [selected, scale]);

	return (
		<Animated.View
			style={[
				st.tile,
				{
					width: width - 6,
					backgroundColor: bg,
					borderColor: selected ? "#fff" : border,
					borderWidth: selected ? 2 : 1.5,
					transform: [{ scale }],
				},
			]}
		>
			<Text
				style={[
					st.tileText,
					{ color: textColor, fontWeight: isGoal ? "900" : "800" },
				]}
			>
				{value}
			</Text>
		</Animated.View>
	);
}

/* ================================================================
   COLUMN COMPONENT
   ================================================================ */

function Column({
	items,
	index,
	isSelected,
	isGoal,
	onPress,
	colWidth,
	valid,
}: {
	items: number[];
	index: number;
	isSelected: boolean;
	isGoal: boolean;
	onPress: (i: number) => void;
	colWidth: number;
	valid: boolean;
}) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const shakeAnim = useRef(new Animated.Value(0)).current;

	const doShake = useCallback(() => {
		Animated.sequence([
			Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
			Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
		]).start();
	}, [shakeAnim]);

	const handlePress = () => {
		onPress(index);
	};

	const bgColor = isGoal
		? "rgba(255,215,0,0.06)"
		: isSelected
			? theme.accentSoft
			: "transparent";
	const borderColor = isGoal
		? "#ffd70050"
		: isSelected
			? theme.tint
			: theme.border + "60";

	return (
		<Pressable onPress={handlePress}>
			<Animated.View
				style={[
					st.column,
					{
						width: colWidth,
						backgroundColor: bgColor,
						borderColor,
						transform: [{ translateX: shakeAnim }],
					},
				]}
			>
				{isGoal && (
					<RNView style={st.goalBadge}>
						<Text style={st.goalBadgeText}>GOAL</Text>
					</RNView>
				)}
				{/* empty slots */}
				{Array.from({ length: MAX_STACK - items.length }).map((_, i) => (
					<RNView
						key={`e${i}`}
						style={[st.emptySlot, { width: colWidth - 6 }]}
					/>
				))}
				{/* tiles from bottom to top */}
				{items.map((val, i) => (
					<Tile
						key={`${val}`}
						value={val}
						selected={isSelected && i === items.length - 1}
						isGoal={isGoal}
						width={colWidth}
					/>
				))}
			</Animated.View>
		</Pressable>
	);
}

/* ================================================================
   STAR DISPLAY
   ================================================================ */

function Stars({ count }: { count: number }) {
	return (
		<RNView style={{ flexDirection: "row", gap: 4, marginVertical: 4 }}>
			{[1, 2, 3].map((s) => (
				<Text key={s} style={{ fontSize: 26, opacity: s <= count ? 1 : 0.2 }}>
					⭐
				</Text>
			))}
		</RNView>
	);
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function StackSortGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);

	const [phase, setPhase] = useState<"menu" | "playing" | "won" | "dead">("menu");
	const [level, setLevel] = useState(0); // index into LEVELS
	const [columns, setColumns] = useState<number[][]>([]);
	const [goal, setGoal] = useState<number[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [moves, setMoves] = useState(0);
	const [history, setHistory] = useState<{ columns: number[][]; goal: number[] }[]>([]);
	const [numCount, setNumCount] = useState(0);

	/* --- start level --- */
	const startLevel = useCallback((lvl: number) => {
		const [nc, cc, ec] = LEVELS[Math.min(lvl, LEVELS.length - 1)];
		const cols = generateLevel(nc, cc, ec);
		setNumCount(nc);
		setColumns(cols);
		setGoal([]);
		setSelected(null);
		setMoves(0);
		setHistory([]);
		setLevel(lvl);
		setPhase("playing");
	}, []);

	/* --- tap handler --- */
	const handleColumnPress = useCallback(
		(colIdx: number) => {
			if (phase !== "playing") return;

			// Special: colIdx === -1 means goal column
			const isGoalTap = colIdx === -1;

			if (selected === null) {
				// Select a source column (can't select goal or empty column)
				if (isGoalTap) return;
				if (columns[colIdx].length === 0) return;
				setSelected(colIdx);
				return;
			}

			// We have a source selected — try to move
			const srcCol = columns[selected];
			const top = srcCol[srcCol.length - 1];

			// Save undo state
			const snapshot = {
				columns: columns.map((c) => [...c]),
				goal: [...goal],
			};

			if (isGoalTap) {
				// Move to goal — only if next expected number
				const nextGoal = goal.length + 1;
				if (top !== nextGoal) {
					setSelected(null);
					return;
				}
				const newCols = columns.map((c) => [...c]);
				newCols[selected] = newCols[selected].slice(0, -1);
				const newGoal = [...goal, top];
				setColumns(newCols);
				setGoal(newGoal);
				setMoves((m) => m + 1);
				setHistory((h) => [...h, snapshot]);
				setSelected(null);

				// Check win
				if (newGoal.length === numCount) {
					setPhase("won");
					// Score: stars based on moves
					const stars = getStars(moves + 1, numCount);
					updateProgress("stack-sort", stars * 100 + (level + 1));
				}
				return;
			}

			// Move to another column
			if (colIdx === selected) {
				// Deselect
				setSelected(null);
				return;
			}

			const destCol = columns[colIdx];
			if (destCol.length >= MAX_STACK) {
				setSelected(null);
				return;
			}
			if (destCol.length > 0 && destCol[destCol.length - 1] <= top) {
				setSelected(null);
				return;
			}

			// Valid move
			const newCols = columns.map((c) => [...c]);
			newCols[selected] = newCols[selected].slice(0, -1);
			newCols[colIdx] = [...newCols[colIdx], top];
			setColumns(newCols);
			setMoves((m) => m + 1);
			setHistory((h) => [...h, snapshot]);
			setSelected(null);

			// Check deadlock after move (async-ish: use new state)
			setTimeout(() => {
				if (isDeadlocked(newCols, goal, numCount)) {
					// Don't immediately end — let player undo
				}
			}, 100);
		},
		[phase, columns, goal, selected, numCount, moves, level, updateProgress],
	);

	/* --- undo --- */
	const undo = useCallback(() => {
		if (history.length === 0) return;
		const prev = history[history.length - 1];
		setColumns(prev.columns);
		setGoal(prev.goal);
		setHistory((h) => h.slice(0, -1));
		setMoves((m) => m + 1); // undo costs a move
		setSelected(null);
	}, [history]);

	/* --- stars --- */
	function getStars(m: number, nc: number): number {
		if (m <= nc * STAR_THRESHOLDS[0]) return 3;
		if (m <= nc * STAR_THRESHOLDS[1]) return 2;
		return 1;
	}

	/* --- deadlocked? --- */
	const dead = phase === "playing" && isDeadlocked(columns, goal, numCount) && history.length === 0;

	/* --- column width --- */
	const totalCols = columns.length + 1; // +1 for goal
	const colWidth = Math.min(52, Math.floor((360 - totalCols * 4) / totalCols));

	/* ================================================================
	   RENDER — MENU
	   ================================================================ */

	if (phase === "menu") {
		return (
			<View style={s.root}>
				<Text style={s.title}>Stack Sort</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					Sort all numbers into the <Text style={{ color: "#ffd700", fontWeight: "800" }}>GOAL</Text> column
					{"\n"}in order: 1 → 2 → 3 → ...
				</Text>

				<RNView style={s.rulesBox}>
					<Text style={[s.ruleText, { color: theme.text }]}>
						📌 Move only the <Text style={{ fontWeight: "800" }}>top</Text> number
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						✅ Place on <Text style={{ fontWeight: "800" }}>empty</Text> or on a <Text style={{ fontWeight: "800" }}>larger</Text> number
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						🔒 Goal column — numbers are <Text style={{ fontWeight: "800" }}>locked</Text> once placed
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						↩️ Use <Text style={{ fontWeight: "800" }}>Undo</Text> if stuck
					</Text>
				</RNView>

				<Text style={[s.levelLabel, { color: theme.mutedText }]}>SELECT LEVEL</Text>
				<ScrollView
					contentContainerStyle={s.levelGrid}
					style={{ maxHeight: 240 }}
				>
					{LEVELS.map((_, i) => (
						<Pressable
							key={i}
							style={[
								s.levelBtn,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => startLevel(i)}
						>
							<Text style={[s.levelBtnText, { color: theme.text }]}>
								{i + 1}
							</Text>
							<Text style={{ fontSize: 8, color: theme.mutedText }}>
								{LEVELS[i][0]}n
							</Text>
						</Pressable>
					))}
				</ScrollView>
			</View>
		);
	}

	/* ================================================================
	   RENDER — WON
	   ================================================================ */

	if (phase === "won") {
		const stars = getStars(moves, numCount);
		return (
			<View style={s.root}>
				<Text style={s.title}>Level {level + 1} Complete!</Text>
				<Stars count={stars} />
				<Text style={[s.movesText, { color: theme.mutedText }]}>
					{moves} moves
				</Text>
				<RNView style={s.btnRow}>
					{level < LEVELS.length - 1 && (
						<Pressable
							style={[s.mainBtn, { backgroundColor: theme.tint }]}
							onPress={() => startLevel(level + 1)}
						>
							<Text style={s.mainBtnText}>NEXT LEVEL</Text>
						</Pressable>
					)}
					<Pressable
						style={[s.mainBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
						onPress={() => startLevel(level)}
					>
						<Text style={[s.mainBtnText, { color: theme.text }]}>RETRY</Text>
					</Pressable>
					<Pressable
						style={[s.mainBtn, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
						onPress={() => setPhase("menu")}
					>
						<Text style={[s.mainBtnText, { color: theme.text }]}>MENU</Text>
					</Pressable>
				</RNView>
			</View>
		);
	}

	/* ================================================================
	   RENDER — PLAYING
	   ================================================================ */

	return (
		<View style={s.root}>
			{/* HUD */}
			<RNView style={s.hud}>
				<Text style={[s.hudText, { color: theme.mutedText }]}>
					Level {level + 1}
				</Text>
				<Text style={[s.hudText, { color: theme.text }]}>
					Moves: {moves}
				</Text>
				<Pressable
					style={[s.undoBtn, { borderColor: theme.border }]}
					onPress={undo}
					disabled={history.length === 0}
				>
					<Text
						style={[
							s.undoBtnText,
							{ color: history.length > 0 ? theme.tint : theme.mutedText + "40" },
						]}
					>
						↩ Undo
					</Text>
				</Pressable>
			</RNView>

			{/* Deadlock warning */}
			{dead && (
				<RNView style={s.deadBanner}>
					<Text style={s.deadText}>No valid moves! Use Undo or Restart</Text>
				</RNView>
			)}

			{/* Board */}
			<ScrollView
				horizontal
				contentContainerStyle={s.boardScroll}
				showsHorizontalScrollIndicator={false}
			>
				<RNView style={s.board}>
					{/* Regular columns */}
					{columns.map((col, i) => (
						<Column
							key={i}
							items={col}
							index={i}
							isSelected={selected === i}
							isGoal={false}
							onPress={handleColumnPress}
							colWidth={colWidth}
							valid={true}
						/>
					))}

					{/* Goal column */}
					<Pressable onPress={() => handleColumnPress(-1)}>
						<RNView
							style={[
								st.column,
								{
									width: colWidth,
									backgroundColor: "rgba(255,215,0,0.06)",
									borderColor: "#ffd70050",
								},
							]}
						>
							<RNView style={st.goalBadge}>
								<Text style={st.goalBadgeText}>GOAL</Text>
							</RNView>
							{/* Show only last few + count */}
							{goal.length > MAX_STACK ? (
								<>
									<RNView style={[st.emptySlot, { width: colWidth - 6 }]}>
										<Text style={{ fontSize: 9, color: "#ffd700", fontWeight: "700" }}>
											...{goal.length - 2} more
										</Text>
									</RNView>
									{goal.slice(-2).map((val) => (
										<Tile key={val} value={val} isGoal width={colWidth} />
									))}
								</>
							) : (
								<>
									{Array.from({ length: MAX_STACK - goal.length }).map((_, i) => (
										<RNView key={`ge${i}`} style={[st.emptySlot, { width: colWidth - 6 }]} />
									))}
									{goal.map((val) => (
										<Tile key={val} value={val} isGoal width={colWidth} />
									))}
								</>
							)}
						</RNView>
					</Pressable>
				</RNView>
			</ScrollView>

			{/* Bottom bar */}
			<RNView style={s.bottomBar}>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => startLevel(level)}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>🔄 Restart</Text>
				</Pressable>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => setPhase("menu")}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>📋 Menu</Text>
				</Pressable>
			</RNView>

			{/* Goal progress bar */}
			<RNView style={s.progressWrap}>
				<RNView
					style={[
						s.progressBar,
						{ width: `${(goal.length / numCount) * 100}%` as never },
					]}
				/>
				<Text style={s.progressText}>
					{goal.length} / {numCount}
				</Text>
			</RNView>
		</View>
	);
}

/* ================================================================
   STYLES — Shared tile/column styles
   ================================================================ */

const st = StyleSheet.create({
	tile: {
		height: 34,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 1,
	},
	tileText: {
		fontSize: 16,
		fontWeight: "800",
	},
	column: {
		borderWidth: 1.5,
		borderRadius: 10,
		padding: 3,
		alignItems: "center",
		justifyContent: "flex-end",
		minHeight: MAX_STACK * 36 + 24,
	},
	emptySlot: {
		height: 34,
		borderRadius: 8,
		marginVertical: 1,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.05)",
		borderStyle: "dashed",
		alignItems: "center",
		justifyContent: "center",
	},
	goalBadge: {
		position: "absolute",
		top: -10,
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderRadius: 4,
		backgroundColor: "#ffd700",
	},
	goalBadgeText: {
		fontSize: 8,
		fontWeight: "900",
		color: "#1a1200",
	},
});

/* ================================================================
   STYLES — Layout
   ================================================================ */

const s = StyleSheet.create({
	root: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 12,
	},
	title: { fontSize: 28, fontWeight: "900", marginBottom: 6 },
	desc: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 10 },
	movesText: { fontSize: 14, marginBottom: 8 },
	rulesBox: { marginBottom: 14, gap: 4 },
	ruleText: { fontSize: 12, lineHeight: 18 },
	levelLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
	levelGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		paddingBottom: 16,
	},
	levelBtn: {
		width: 52,
		height: 52,
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
		paddingHorizontal: 8,
		marginBottom: 8,
	},
	hudText: { fontSize: 14, fontWeight: "700" },
	undoBtn: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 8,
		borderWidth: 1,
	},
	undoBtnText: { fontSize: 13, fontWeight: "700" },

	deadBanner: {
		backgroundColor: "rgba(239,83,80,0.15)",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		marginBottom: 6,
	},
	deadText: { color: "#ef5350", fontSize: 12, fontWeight: "700" },

	boardScroll: { paddingHorizontal: 8 },
	board: {
		flexDirection: "row",
		gap: 6,
		alignItems: "flex-end",
		paddingTop: 16,
	},

	bottomBar: {
		flexDirection: "row",
		gap: 12,
		marginTop: 12,
	},
	smallBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
	},
	smallBtnText: { fontSize: 13, fontWeight: "600" },

	progressWrap: {
		width: "80%",
		height: 18,
		borderRadius: 9,
		backgroundColor: "rgba(255,215,0,0.1)",
		marginTop: 10,
		overflow: "hidden",
		justifyContent: "center",
		alignItems: "center",
	},
	progressBar: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		backgroundColor: "rgba(255,215,0,0.25)",
		borderRadius: 9,
	},
	progressText: {
		fontSize: 10,
		fontWeight: "800",
		color: "#ffd700",
	},

	mainBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 12,
		marginTop: 4,
	},
	mainBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
	btnRow: { gap: 8, alignItems: "center", marginTop: 8 },
});
