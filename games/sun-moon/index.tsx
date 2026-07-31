import { useMemo, useState } from "react";
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
import { Radius, Spacing } from "@/constants/Spacing";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import { LEVELS } from "./levels";

// Stable fallback: returning a fresh `{}` from a Zustand selector makes
// getSnapshot produce a new reference every call, which loops React's
// useSyncExternalStore until it throws on first open (no progress entry yet).
const EMPTY_LEVEL_STARS: Record<string, number> = {};
import {
	cellIndex,
	findConflicts,
	isSolvedGrid,
	parseRows,
	type SunMoonCell,
} from "./logic";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_CELL = 52;
const CELL_GAP = 4;
const GRID_PADDING = 20;

/** Mistake thresholds → stars: 0 = 3★, ≤3 = 2★, else 1★. */
function getStars(mistakes: number): number {
	if (mistakes === 0) return 3;
	if (mistakes <= 3) return 2;
	return 1;
}

const SYMBOLS: Record<SunMoonCell, string> = {
	S: "☀️",
	M: "🌙",
	".": "",
};

const NEXT_CELL: Record<SunMoonCell, SunMoonCell> = {
	".": "S",
	S: "M",
	M: ".",
};

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

type Phase = "menu" | "playing" | "won";

export default function SunMoonGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const updateProgress = useGameStore((s) => s.updateProgress);
	const levelStars =
		useGameStore((s) => s.progress["sun-moon"]?.levelStars) ??
		EMPTY_LEVEL_STARS;
	const { width: screenW } = useWindowDimensions();

	const [phase, setPhase] = useState<Phase>("menu");
	const [levelIdx, setLevelIdx] = useState(0);
	const [cells, setCells] = useState<SunMoonCell[]>([]);
	const [givenMask, setGivenMask] = useState<boolean[]>([]);
	const [mistakes, setMistakes] = useState(0);
	const [wonStars, setWonStars] = useState(0);

	const level = LEVELS[levelIdx];
	const size = level.size;

	const conflicts = useMemo(
		() => findConflicts(cells, size),
		[cells, size],
	);

	/* --- derived layout: 8×8 must fit phone width --- */
	const maxBoardWidth = Math.min(screenW - GRID_PADDING * 2, 400);
	const cellSize = Math.min(
		MAX_CELL,
		Math.floor((maxBoardWidth - CELL_GAP * (size - 1)) / size),
	);

	/* --- start level --- */
	const startLevel = (idx: number) => {
		const start = parseRows(LEVELS[idx].givens);
		setLevelIdx(idx);
		setCells(start);
		setGivenMask(start.map((cell) => cell !== "."));
		setMistakes(0);
		setWonStars(0);
		setPhase("playing");
	};

	/* --- tap handler: cycle blank → ☀️ → 🌙 → blank --- */
	const handleCellPress = (idx: number) => {
		if (phase !== "playing") return;
		if (givenMask[idx]) return;

		const nextValue = NEXT_CELL[cells[idx]];
		const nextCells = [...cells];
		nextCells[idx] = nextValue;
		const nextConflicts = findConflicts(nextCells, size);

		// A placement (not a clear) that yields any NEW conflict counts once.
		if (nextValue !== ".") {
			let createdConflict = false;
			for (const c of nextConflicts) {
				if (!conflicts.has(c)) {
					createdConflict = true;
					break;
				}
			}
			if (createdConflict) {
				setMistakes((m) => m + 1);
				haptic.error();
			} else {
				haptic.tap();
			}
		} else {
			haptic.tap();
		}

		setCells(nextCells);

		if (isSolvedGrid(nextCells, size)) {
			// A solved grid has zero conflicts by definition, so the winning
			// placement can never have been a mistake — `mistakes` is final here.
			const stars = getStars(mistakes);
			setWonStars(stars);
			haptic.success();
			updateProgress("sun-moon", stars, {
				won: true,
				levelStarsPatch: { [String(level.id)]: stars },
			});
			setPhase("won");
		}
	};

	/* ================================================================
	   RENDER — MENU (level select)
	   ================================================================ */

	if (phase === "menu") {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("gameSunMoonName")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("gameSunMoonDescription")}
				</Text>
				<Text style={[s.hint, { color: theme.mutedText }]}>
					{t("gameTapToStart")}
				</Text>

				<Text style={[s.sectionLabel, { color: theme.mutedText }]}>
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
								{lvl.size}×{lvl.size}
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
		return (
			<View style={s.root}>
				<Text style={s.wonEmoji}>☀️🌙</Text>
				<Text style={s.title}>{t("sunMoonSolved")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("levelLabel", { level: level.id })}
				</Text>
				<Stars count={wonStars} />
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
				<RNView style={[s.pill, { backgroundColor: theme.card }]}>
					<Text style={[s.pillText, { color: theme.text }]}>
						{t("levelLabel", { level: level.id })}
					</Text>
				</RNView>
				<RNView
					style={[
						s.pill,
						{
							backgroundColor:
								conflicts.size > 0 ? theme.dangerSurface : theme.card,
						},
					]}
				>
					<Text
						style={[
							s.pillText,
							{ color: conflicts.size > 0 ? theme.danger : theme.mutedText },
						]}
					>
						{t("sunMoonConflicts", { count: conflicts.size })}
					</Text>
				</RNView>
			</RNView>

			{/* Board */}
			<RNView style={s.boardWrapper}>
				<RNView style={{ gap: CELL_GAP }}>
					{Array.from({ length: size }, (_, row) => (
						<RNView
							// biome-ignore lint/suspicious/noArrayIndexKey: rows are static per level
							key={row}
							style={{ flexDirection: "row", gap: CELL_GAP }}
						>
							{Array.from({ length: size }, (_, col) => {
								const idx = cellIndex(row, col, size);
								const value = cells[idx];
								const isGiven = givenMask[idx];
								const isConflict = conflicts.has(idx);
								const symbolName =
									value === "S" ? "sun" : value === "M" ? "moon" : "empty";
								return (
									<Pressable
										key={idx}
										onPress={() => handleCellPress(idx)}
										disabled={isGiven}
										accessibilityRole="button"
										accessibilityLabel={`Row ${row + 1}, column ${col + 1}: ${symbolName}`}
										accessibilityState={{ disabled: isGiven }}
										style={[
											s.cell,
											{
												width: cellSize,
												height: cellSize,
												backgroundColor: isConflict
													? theme.dangerSurface
													: isGiven
														? theme.surface
														: theme.elevated,
												borderColor: isConflict
													? theme.dangerBorder
													: isGiven
														? theme.border
														: theme.tint + "50",
											},
										]}
									>
										<Text style={{ fontSize: Math.floor(cellSize * 0.55) }}>
											{SYMBOLS[value]}
										</Text>
									</Pressable>
								);
							})}
						</RNView>
					))}
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
		padding: GRID_PADDING,
	},
	title: { fontSize: 28, fontWeight: "900", marginBottom: 6 },
	desc: {
		fontSize: 13,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: Spacing.sm,
	},
	hint: { fontSize: 12, marginBottom: Spacing.lg },
	sectionLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		marginBottom: 6,
		textTransform: "uppercase",
	},
	levelGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingBottom: Spacing.lg,
	},
	levelBtn: {
		width: 60,
		height: 60,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	levelBtnText: { fontSize: 18, fontWeight: "800" },

	hud: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
		marginBottom: Spacing.md,
	},
	pill: {
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: Radius.pill,
	},
	pillText: { fontSize: 13, fontWeight: "700" },

	boardWrapper: {
		alignItems: "center",
		justifyContent: "center",
	},
	cell: {
		borderRadius: Radius.sm,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},

	bottomBar: {
		flexDirection: "row",
		gap: Spacing.md,
		marginTop: Spacing.xl,
	},
	smallBtn: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.sm + 2,
		borderWidth: 1,
	},
	smallBtnText: { fontSize: 13, fontWeight: "600" },

	wonEmoji: { fontSize: 44, marginBottom: Spacing.sm },
	btnCol: { gap: Spacing.sm, alignItems: "center", marginTop: Spacing.md },
	mainBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: Radius.card,
		minWidth: 180,
		alignItems: "center",
	},
	mainBtnText: { fontWeight: "800", fontSize: 15 },
});
