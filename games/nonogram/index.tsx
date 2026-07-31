import { useCallback, useMemo, useState } from "react";
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
import { FontSize, FontWeight } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";

import { NONOGRAM_LEVELS, type NonogramLevel } from "./levels";
import {
	deriveClues,
	EMPTY,
	FILLED,
	UNKNOWN,
	countFilledCells,
	isLineSatisfied,
	type CellState,
} from "./logic";

/* ================================================================
   CONSTANTS
   ================================================================ */

const MAX_CELL = 34; // biggest comfortable cell
const CLUE_DIGIT_W = 13; // width reserved per row-clue number
const CLUE_LINE_H = 13; // height reserved per column-clue number
const GROUP_GAP = 4; // extra gap after every 5th line

type Phase = "menu" | "playing" | "won";
type Mode = "fill" | "mark";

/* ================================================================
   HELPERS
   ================================================================ */

function makeEmptyGrid(size: number): CellState[][] {
	return Array.from({ length: size }, () =>
		new Array<CellState>(size).fill(UNKNOWN),
	);
}

function starsForMistakes(mistakes: number): number {
	if (mistakes === 0) return 3;
	if (mistakes <= 2) return 2;
	return 1;
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
   REVEALED PIXEL ART (win overlay)
   ================================================================ */

function PixelArt({
	solution,
	tint,
	surface,
}: {
	solution: string[];
	tint: string;
	surface: string;
}) {
	const size = solution.length;
	const cell = Math.max(10, Math.floor(180 / size));
	return (
		<RNView style={{ marginVertical: Spacing.md }}>
			{solution.map((row, r) => (
				<RNView key={`art-row-${r + 1}-${row}`} style={{ flexDirection: "row" }}>
					{[...row].map((ch, c) => (
						<RNView
							// biome-ignore lint/suspicious/noArrayIndexKey: static art grid
							key={`art-${r}-${c}`}
							style={{
								width: cell,
								height: cell,
								borderRadius: 2,
								margin: 0.5,
								backgroundColor: ch === "#" ? tint : surface,
							}}
						/>
					))}
				</RNView>
			))}
		</RNView>
	);
}

/* ================================================================
   MAIN GAME COMPONENT
   ================================================================ */

export default function NonogramGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width: screenW } = useWindowDimensions();
	const updateProgress = useGameStore((s) => s.updateProgress);
	const levelStars = useGameStore(
		(s) => s.progress.nonogram?.levelStars ?? {},
	);

	const [phase, setPhase] = useState<Phase>("menu");
	const [level, setLevel] = useState<NonogramLevel>(NONOGRAM_LEVELS[0]);
	const [grid, setGrid] = useState<CellState[][]>(() => makeEmptyGrid(5));
	const [mode, setMode] = useState<Mode>("fill");
	const [mistakes, setMistakes] = useState(0);

	const clues = useMemo(() => deriveClues(level.solution), [level]);
	const totalFilled = useMemo(() => countFilledCells(level.solution), [level]);

	/* --- start level --- */
	const startLevel = useCallback((lvl: NonogramLevel) => {
		setLevel(lvl);
		setGrid(makeEmptyGrid(lvl.size));
		setMode("fill");
		setMistakes(0);
		setPhase("playing");
	}, []);

	/* --- win check + tap handler --- */
	const handleCellPress = (r: number, c: number) => {
		if (phase !== "playing") return;
		const current = grid[r][c];

		if (mode === "mark") {
			if (current === FILLED) return;
			haptic.tap();
			const next = grid.map((row) => [...row]);
			next[r][c] = current === EMPTY ? UNKNOWN : EMPTY;
			setGrid(next);
			return;
		}

		// Fill mode — only unknown cells are actionable.
		if (current !== UNKNOWN) return;
		const next = grid.map((row) => [...row]);

		if (level.solution[r][c] !== "#") {
			// Picross mistake rule: wrong fill counts a mistake and auto-marks X.
			haptic.error();
			next[r][c] = EMPTY;
			setGrid(next);
			setMistakes((m) => m + 1);
			return;
		}

		haptic.tap();
		next[r][c] = FILLED;
		setGrid(next);

		const filledCount = next.flat().filter((s) => s === FILLED).length;
		if (filledCount === totalFilled) {
			haptic.heavy();
			setPhase("won");
			const stars = starsForMistakes(mistakes);
			updateProgress("nonogram", stars, {
				won: true,
				levelStarsPatch: { [String(level.id)]: stars },
			});
		}
	};

	/* --- layout --- */
	const size = level.size;
	const maxRowClues = Math.max(1, ...clues.rows.map((r) => r.length));
	const maxColClues = Math.max(1, ...clues.cols.map((c) => c.length));
	const rowGutterW = maxRowClues * CLUE_DIGIT_W + Spacing.sm;
	const colGutterH = maxColClues * CLUE_LINE_H + Spacing.xs;
	const groupGaps = Math.floor((size - 1) / 5) * GROUP_GAP;
	const cellSize = Math.min(
		MAX_CELL,
		Math.floor(
			(screenW - Spacing.lg * 2 - rowGutterW - groupGaps - size * 2) / size,
		),
	);

	const rowSatisfied = clues.rows.map((clue, r) =>
		isLineSatisfied(
			clue,
			grid[r].map((s) => s === FILLED),
		),
	);
	const colSatisfied = clues.cols.map((clue, c) =>
		isLineSatisfied(
			clue,
			grid.map((row) => row[c] === FILLED),
		),
	);

	/* ================================================================
	   RENDER — MENU
	   ================================================================ */

	if (phase === "menu") {
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("gameNonogramName")}</Text>
				<Text style={[s.desc, { color: theme.mutedText }]}>
					{t("gameNonogramDescription")}
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
					{NONOGRAM_LEVELS.map((lvl) => (
						<Pressable
							key={`level-${lvl.id}`}
							style={[
								s.levelBtn,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
							onPress={() => startLevel(lvl)}
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
		const stars = starsForMistakes(mistakes);
		const nextLevel = NONOGRAM_LEVELS.find((l) => l.id === level.id + 1);
		return (
			<View style={s.root}>
				<Text style={s.title}>{t("nonoSolved")}</Text>
				<PixelArt
					solution={level.solution}
					tint={theme.tint}
					surface={theme.surface}
				/>
				<Stars count={stars} />
				<Text style={[s.hint, { color: theme.mutedText }]}>
					{t("nonoMistakes", { count: mistakes })}
				</Text>
				<RNView style={s.btnCol}>
					{nextLevel && (
						<Pressable
							style={[s.mainBtn, { backgroundColor: theme.tint }]}
							onPress={() => startLevel(nextLevel)}
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
						onPress={() => startLevel(level)}
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

	const cellOuter = (index: number) => ({
		marginRight:
			(index + 1) % 5 === 0 && index !== size - 1 ? GROUP_GAP + 2 : 2,
	});
	const rowOuter = (index: number) => ({
		marginBottom:
			(index + 1) % 5 === 0 && index !== size - 1 ? GROUP_GAP + 2 : 2,
	});

	return (
		<View style={s.root}>
			{/* HUD */}
			<RNView style={s.hud}>
				<Text style={[s.hudText, { color: theme.mutedText }]}>
					{t("levelLabel", { level: level.id })}
				</Text>
				<Text
					style={[
						s.hudText,
						{ color: mistakes > 0 ? theme.danger : theme.text },
					]}
				>
					{t("nonoMistakes", { count: mistakes })}
				</Text>
			</RNView>

			{/* Board */}
			<RNView style={{ marginTop: Spacing.sm }}>
				{/* Column clues */}
				<RNView style={{ flexDirection: "row" }}>
					<RNView style={{ width: rowGutterW }} />
					{clues.cols.map((clue, c) => (
						<RNView
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
							key={`col-clue-${c}`}
							style={[
								{
									width: cellSize,
									height: colGutterH,
									justifyContent: "flex-end",
									alignItems: "center",
								},
								cellOuter(c),
							]}
						>
							{(clue.length > 0 ? clue : [0]).map((n, i) => (
								<Text
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed clue list
									key={`col-clue-${c}-${i}`}
									style={[
										s.clueText,
										{
											color: colSatisfied[c]
												? theme.mutedText + "70"
												: theme.text,
										},
									]}
								>
									{n}
								</Text>
							))}
						</RNView>
					))}
				</RNView>

				{/* Rows: clue gutter + cells */}
				{grid.map((row, r) => (
					<RNView
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
						key={`row-${r}`}
						style={[{ flexDirection: "row", alignItems: "center" }, rowOuter(r)]}
					>
						<RNView
							style={{
								width: rowGutterW,
								flexDirection: "row",
								justifyContent: "flex-end",
								paddingRight: Spacing.xs,
								gap: 3,
							}}
						>
							{(clues.rows[r].length > 0 ? clues.rows[r] : [0]).map((n, i) => (
								<Text
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed clue list
									key={`row-clue-${r}-${i}`}
									style={[
										s.clueText,
										{
											color: rowSatisfied[r]
												? theme.mutedText + "70"
												: theme.text,
										},
									]}
								>
									{n}
								</Text>
							))}
						</RNView>
						{row.map((cell, c) => (
							<Pressable
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
								key={`cell-${r}-${c}`}
								onPress={() => handleCellPress(r, c)}
								accessibilityRole="button"
								accessibilityLabel={`Row ${r + 1}, column ${c + 1}`}
								style={[
									{
										width: cellSize,
										height: cellSize,
										borderRadius: 4,
										borderWidth: 1,
										alignItems: "center",
										justifyContent: "center",
										backgroundColor:
											cell === FILLED ? theme.tint : theme.elevated,
										borderColor:
											cell === FILLED ? theme.tint : theme.border,
									},
									cellOuter(c),
								]}
							>
								{cell === EMPTY && (
									<Text
										style={{
											fontSize: Math.max(10, cellSize * 0.45),
											fontWeight: FontWeight.bold,
											color: theme.mutedText,
										}}
									>
										✕
									</Text>
								)}
							</Pressable>
						))}
					</RNView>
				))}
			</RNView>

			{/* Fill / Mark mode toggle */}
			<RNView style={s.modeRow}>
				<Pressable
					style={[
						s.modeBtn,
						{
							backgroundColor: mode === "fill" ? theme.tint : theme.surface,
							borderColor: mode === "fill" ? theme.tint : theme.border,
						},
					]}
					onPress={() => setMode("fill")}
					accessibilityRole="button"
					accessibilityState={{ selected: mode === "fill" }}
					accessibilityLabel={t("nonoFill")}
				>
					<Text
						style={[
							s.modeBtnText,
							{ color: mode === "fill" ? theme.onTint : theme.text },
						]}
					>
						■ {t("nonoFill")}
					</Text>
				</Pressable>
				<Pressable
					style={[
						s.modeBtn,
						{
							backgroundColor: mode === "mark" ? theme.tint : theme.surface,
							borderColor: mode === "mark" ? theme.tint : theme.border,
						},
					]}
					onPress={() => setMode("mark")}
					accessibilityRole="button"
					accessibilityState={{ selected: mode === "mark" }}
					accessibilityLabel={t("nonoMark")}
				>
					<Text
						style={[
							s.modeBtnText,
							{ color: mode === "mark" ? theme.onTint : theme.text },
						]}
					>
						✕ {t("nonoMark")}
					</Text>
				</Pressable>
			</RNView>

			{/* Bottom bar */}
			<RNView style={s.bottomBar}>
				<Pressable
					style={[s.smallBtn, { borderColor: theme.border }]}
					onPress={() => startLevel(level)}
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
		padding: Spacing.md,
	},
	title: {
		fontSize: FontSize["3xl"],
		fontWeight: FontWeight.black,
		marginBottom: Spacing.xs,
	},
	desc: {
		fontSize: FontSize.sm,
		textAlign: "center",
		lineHeight: 20,
		marginBottom: Spacing.xs,
	},
	hint: {
		fontSize: FontSize.sm,
		fontWeight: FontWeight.semibold,
		textAlign: "center",
		marginBottom: Spacing.md,
	},
	sectionLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 1,
		textTransform: "uppercase",
		marginBottom: Spacing.sm,
	},
	levelGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: Spacing.sm,
		paddingBottom: Spacing.lg,
	},
	levelBtn: {
		width: 56,
		height: 56,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	levelBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },

	hud: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
		paddingHorizontal: Spacing.xs,
	},
	hudText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

	clueText: {
		fontSize: 11,
		fontWeight: FontWeight.bold,
		fontVariant: ["tabular-nums"],
		lineHeight: 13,
	},

	modeRow: {
		flexDirection: "row",
		gap: Spacing.sm,
		marginTop: Spacing.lg,
	},
	modeBtn: {
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.sm + 2,
		borderRadius: Radius.button,
		borderWidth: 1.5,
	},
	modeBtnText: {
		fontSize: FontSize.base,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 0.5,
	},

	bottomBar: {
		flexDirection: "row",
		gap: Spacing.md,
		marginTop: Spacing.md,
	},
	smallBtn: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.sm + 2,
		borderWidth: 1,
	},
	smallBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

	btnCol: { gap: Spacing.sm, alignItems: "center", marginTop: Spacing.sm },

	mainBtn: {
		paddingHorizontal: Spacing["3xl"],
		paddingVertical: Spacing.md,
		borderRadius: Radius.card,
	},
	mainBtnText: { fontWeight: FontWeight.extrabold, fontSize: FontSize.md },
});
