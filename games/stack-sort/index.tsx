import React, { useState, useRef, useCallback, useEffect } from "react";
import {
	StyleSheet,
	Pressable,
	Animated,
	Easing,
	ScrollView,
	View as RNView,
	useWindowDimensions,
} from "react-native";

import { Text, View } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_STACK = 5; // max items per column
const MIN_COL_W = 46; // min width so numbers are always readable

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

const STAR_THRESHOLDS = [1.8, 3.0]; // multiplier of numCount → 3★, 2★ (harder with chaos)

/* ================================================================
   TILE COLORS (mod 12 palette)
   ================================================================ */

const TILE_COLORS = [
	"#ef5350",
	"#42a5f5",
	"#66bb6a",
	"#ffa726",
	"#ab47bc",
	"#26c6da",
	"#ec407a",
	"#8d6e63",
	"#78909c",
	"#d4e157",
	"#7e57c2",
	"#29b6f6",
];

function tileColor(n: number): string {
	return TILE_COLORS[(n - 1) % TILE_COLORS.length];
}

/* ================================================================
   CHAOTIC LEVEL GENERATOR
   ================================================================ */

/**
 * Pure random shuffle — numbers are dealt into columns without any
 * ordering constraint. Columns may contain e.g. [5, 1, 8, 3].
 * Player must sort within columns AND into the goal.
 */
function generateLevel(
	numCount: number,
	columnCount: number,
	emptyColumns: number,
): number[][] {
	const usable = columnCount - emptyColumns;
	const cols: number[][] = Array.from({ length: columnCount }, () => []);

	// Build shuffled deck
	const deck: number[] = [];
	for (let i = 1; i <= numCount; i++) deck.push(i);
	// Fisher-Yates
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}

	// Deal round-robin into usable columns, respecting MAX_STACK
	let ci = 0;
	for (const num of deck) {
		let tries = 0;
		while (cols[ci % usable].length >= MAX_STACK) {
			ci++;
			tries++;
			if (tries > usable) break;
		}
		cols[ci % usable].push(num);
		ci++;
	}

	// Shuffle column order so empty ones aren't always at the end
	for (let i = cols.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cols[i], cols[j]] = [cols[j], cols[i]];
	}

	return cols;
}

/* ================================================================
   DEADLOCK DETECTION
   ================================================================ */

function isDeadlocked(columns: number[][], goal: number[]): boolean {
	const nextGoal = goal.length + 1;
	for (let i = 0; i < columns.length; i++) {
		const col = columns[i];
		if (col.length === 0) return false;
		const top = col[col.length - 1];
		if (top === nextGoal) return false;
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
   ANIMATED TILE — always visible, min width enforced
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
			Animated.timing(scale, {
				toValue: 1.15,
				duration: 120,
				easing: Easing.out(Easing.back(2)),
				useNativeDriver: true,
			}).start();
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
			style={{
				width: width - 6,
				height: 30,
				borderRadius: 7,
				alignItems: "center",
				justifyContent: "center",
				marginVertical: 1,
				backgroundColor: bg,
				borderColor: selected ? "#fff" : border,
				borderWidth: selected ? 2 : 1.5,
				transform: [{ scale }],
			}}
		>
			<Text style={{ fontSize: 14, fontWeight: "800", color: textColor }}>
				{value}
			</Text>
		</Animated.View>
	);
}

/* ================================================================
   COLUMN COMPONENT — shows ALL tiles (no hidden items)
   ================================================================ */

function ColumnView({
	items,
	index,
	isSelected,
	isGoal,
	onPress,
	colWidth,
	label,
	goalBadgeLabel,
}: {
	items: number[];
	index: number;
	isSelected: boolean;
	isGoal: boolean;
	onPress: (i: number) => void;
	colWidth: number;
	label?: string;
	goalBadgeLabel: string;
}) {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];

	const bgColor = isGoal
		? "rgba(255,215,0,0.06)"
		: isSelected
			? theme.accentSoft
			: "transparent";
	const borderColor = isGoal
		? "#ffd70060"
		: isSelected
			? theme.tint
			: theme.border + "50";

	return (
		<Pressable onPress={() => onPress(index)}>
			<RNView
				style={{
					width: colWidth,
					borderWidth: 1.5,
					borderRadius: 10,
					padding: 3,
					alignItems: "center",
					justifyContent: "flex-end",
					minHeight: 50,
					backgroundColor: bgColor,
					borderColor,
				}}
			>
				{/* Badge */}
				{isGoal && (
					<RNView style={st.goalBadge}>
						<Text style={st.goalBadgeText}>{goalBadgeLabel}</Text>
					</RNView>
				)}
				{label && !isGoal && (
					<Text
						style={{
							fontSize: 7,
							fontWeight: "700",
							color: theme.mutedText + "80",
							position: "absolute",
							top: 2,
						}}
					>
						{label}
					</Text>
				)}
				{/* All tiles — always visible */}
				{items.length === 0 && (
					<RNView
						style={{
							width: colWidth - 8,
							height: 30,
							borderRadius: 7,
							borderWidth: 1,
							borderColor: "rgba(255,255,255,0.06)",
							borderStyle: "dashed",
						}}
					/>
				)}
				{items.map((val, i) => (
					<Tile
						key={`${index}-${i}-${val}`}
						value={val}
						selected={isSelected && i === items.length - 1}
						isGoal={isGoal}
						width={colWidth}
					/>
				))}
			</RNView>
		</Pressable>
	);
}

/* ================================================================
   STAR DISPLAY
   ================================================================ */

function Stars({ count }: { count: number }) {
	return (
		<RNView style={{ flexDirection: "row", gap: 4, marginVertical: 4 }}>
			{[1, 2, 3].map((i) => (
				<Text key={i} style={{ fontSize: 26, opacity: i <= count ? 1 : 0.2 }}>
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
	const { t } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { width: screenW } = useWindowDimensions();

	const [phase, setPhase] = useState<"menu" | "playing" | "won">("menu");
	const [level, setLevel] = useState(0);
	const [columns, setColumns] = useState<number[][]>([]);
	const [goal, setGoal] = useState<number[]>([]);
	const [selected, setSelected] = useState<number | null>(null);
	const [moves, setMoves] = useState(0);
	const [history, setHistory] = useState<
		{ columns: number[][]; goal: number[] }[]
	>([]);
	const [numCount, setNumCount] = useState(0);

	/* --- derived layout --- */
	const totalCols = columns.length + 1; // +1 for goal
	const maxPerRow = Math.max(3, Math.floor((screenW - 24) / (MIN_COL_W + 8)));
	const colWidth = Math.max(
		MIN_COL_W,
		Math.floor((screenW - 24 - maxPerRow * 8) / maxPerRow),
	);

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
			const isGoalTap = colIdx === -1;

			if (selected === null) {
				if (isGoalTap) return;
				if (columns[colIdx].length === 0) return;
				setSelected(colIdx);
				return;
			}

			const srcCol = columns[selected];
			const top = srcCol[srcCol.length - 1];
			const snapshot = {
				columns: columns.map((c) => [...c]),
				goal: [...goal],
			};

			if (isGoalTap) {
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

				if (newGoal.length === numCount) {
					haptic.heavy();
					setPhase("won");
					const stars = getStars(moves + 1, numCount);
					updateProgress("stack-sort", stars * 100 + (level + 1));
				}
				return;
			}

			if (colIdx === selected) {
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

			const newCols = columns.map((c) => [...c]);
			newCols[selected] = newCols[selected].slice(0, -1);
			newCols[colIdx] = [...newCols[colIdx], top];
			setColumns(newCols);
			haptic.tap();
			setMoves((m) => m + 1);
			setHistory((h) => [...h, snapshot]);
			setSelected(null);
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
		setMoves((m) => m + 1);
		setSelected(null);
	}, [history]);

	/* --- stars --- */
	function getStars(m: number, nc: number): number {
		if (m <= nc * STAR_THRESHOLDS[0]) return 3;
		if (m <= nc * STAR_THRESHOLDS[1]) return 2;
		return 1;
	}

	const dead =
		phase === "playing" && isDeadlocked(columns, goal) && history.length === 0;

	/* ================================================================
	   RENDER — MENU
	   ================================================================ */

	if (phase === "menu") {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("stackSortTitle")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("stackSortIntro")}
				</Text>

				<RNView style={s.rulesBox}>
					<Text style={[s.ruleText, { color: theme.text }]}>
						{t("stackSortRuleTop")}
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						{t("stackSortRulePlace")}
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						{t("stackSortRuleGoalLock")}
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						{t("stackSortRuleChaos")}
					</Text>
					<Text style={[s.ruleText, { color: theme.text }]}>
						{t("stackSortRuleUndo")}
					</Text>
				</RNView>

				<Text style={[s.levelLabel, { color: theme.mutedText }]}>
					{t("stackSortSelectLevel")}
				</Text>
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
				<Text style={s.title}>
					{t("stackSortLevelComplete", { level: level + 1 })}
				</Text>
				<Stars count={stars} />
				<Text style={[s.movesText, { color: theme.mutedText }]}>
					{t("stackSortMovesCount", { count: moves })}
				</Text>
				<RNView style={s.btnRow}>
					{level < LEVELS.length - 1 && (
						<Pressable
							style={[s.mainBtn, { backgroundColor: theme.tint }]}
							onPress={() => startLevel(level + 1)}
						>
							<Text style={s.mainBtnText}>{t("stackSortNextLevel")}</Text>
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
						onPress={() => startLevel(level)}
					>
						<Text style={[s.mainBtnText, { color: theme.text }]}>
							{t("stackSortRetry")}
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
					>
						<Text style={[s.mainBtnText, { color: theme.text }]}>
							{t("stackSortMenu")}
						</Text>
					</Pressable>
				</RNView>
			</View>
		);
	}

	/* ================================================================
	   RENDER — PLAYING  (scattered grid layout)
	   ================================================================ */

	const allCols: {
		items: number[];
		idx: number;
		isGoal: boolean;
		label: string;
	}[] = [];
	columns.forEach((col, i) => {
		allCols.push({ items: col, idx: i, isGoal: false, label: `#${i + 1}` });
	});
	allCols.push({ items: goal, idx: -1, isGoal: true, label: "GOAL" });

	return (
		<View style={s.root}>
			{/* HUD */}
			<RNView style={s.hud}>
				<Text style={[s.hudText, { color: theme.mutedText }]}>
					{t("stackSortHudLevel", { level: level + 1 })}
				</Text>
				<Text style={[s.hudText, { color: theme.text }]}>
					{t("stackSortHudMoves", { moves })}
				</Text>
				<Text style={[s.hudText, { color: "#ffd700" }]}>
					{goal.length}/{numCount}
				</Text>
				<Pressable
					style={[s.undoBtn, { borderColor: theme.border }]}
					onPress={undo}
					disabled={history.length === 0}
				>
					<Text
						style={{
							fontSize: 13,
							fontWeight: "700",
							color: history.length > 0 ? theme.tint : theme.mutedText + "40",
						}}
					>
						{t("stackSortUndo")}
					</Text>
				</Pressable>
			</RNView>

			{/* Deadlock warning */}
			{dead && (
				<RNView style={s.deadBanner}>
					<Text style={s.deadText}>{t("stackSortDeadlock")}</Text>
				</RNView>
			)}

			{/* Scattered grid board */}
			<ScrollView
				style={{ flex: 1, width: "100%" }}
				contentContainerStyle={{ paddingBottom: 16 }}
			>
				<RNView style={s.grid}>
					{allCols.map((c) => (
						<ColumnView
							key={c.isGoal ? "goal" : c.idx}
							items={c.items}
							index={c.idx}
							isSelected={selected === c.idx && !c.isGoal}
							isGoal={c.isGoal}
							onPress={handleColumnPress}
							colWidth={colWidth}
							label={c.label}
							goalBadgeLabel={t("stackSortGoal")}
						/>
					))}
				</RNView>
			</ScrollView>

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

			{/* Bottom bar */}
			<RNView style={s.bottomBar}>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => startLevel(level)}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>
						{t("stackSortRestart")}
					</Text>
				</Pressable>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => setPhase("menu")}
				>
					<Text style={[s.smallBtnText, { color: theme.text }]}>
						{t("stackSortMenu")}
					</Text>
				</Pressable>
			</RNView>
		</View>
	);
}

/* ================================================================
   STYLES — shared
   ================================================================ */

const st = StyleSheet.create({
	goalBadge: {
		position: "absolute",
		top: -10,
		paddingHorizontal: 6,
		paddingVertical: 1,
		borderRadius: 4,
		backgroundColor: "#ffd700",
		zIndex: 2,
	},
	goalBadgeText: {
		fontSize: 8,
		fontWeight: "900",
		color: "#1a1200",
	},
});

/* ================================================================
   STYLES — layout
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
		paddingHorizontal: 4,
		marginBottom: 6,
	},
	hudText: { fontSize: 13, fontWeight: "700" },
	undoBtn: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 8,
		borderWidth: 1,
	},

	deadBanner: {
		backgroundColor: "rgba(239,83,80,0.15)",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		marginBottom: 6,
	},
	deadText: { color: "#ef5350", fontSize: 12, fontWeight: "700" },

	/* Scattered wrapped grid — columns flow across the screen in rows */
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		paddingTop: 14,
		paddingHorizontal: 4,
	},

	progressWrap: {
		width: "85%",
		height: 18,
		borderRadius: 9,
		backgroundColor: "rgba(255,215,0,0.1)",
		marginTop: 8,
		marginBottom: 4,
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

	bottomBar: {
		flexDirection: "row",
		gap: 12,
		marginTop: 6,
		marginBottom: 4,
	},
	smallBtn: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
	},
	smallBtnText: { fontSize: 13, fontWeight: "600" },

	mainBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 12,
		marginTop: 4,
	},
	mainBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
	btnRow: { gap: 8, alignItems: "center", marginTop: 8 },
});
