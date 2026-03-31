import { useState, useCallback } from "react";
import { Dimensions, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import GameResult from "@/components/GameResult";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useHaptic } from "@/hooks/useHaptic";

const GRID = 8;
const { width: SW } = Dimensions.get("window");
const CELL = Math.floor((SW - 52) / (GRID + 1));

const SHIPS = [
	{ id: "scout", size: 2 },
	{ id: "fighter", size: 3 },
	{ id: "bomber", size: 4 },
] as const;
const TOTAL_HP = 9; // 2+3+4

const SHIP_LABELS: Record<string, TranslationKey> = {
	scout: "arShipScout",
	fighter: "arShipFighter",
	bomber: "arShipBomber",
};

type Cell = "w" | "s" | "h" | "m"; // water, ship, hit, miss
type Phase = "setup" | "battle" | "done";
type Tab = "fleet" | "radar";

const COL = "ABCDEFGH";

const blank = (): Cell[][] =>
	Array.from({ length: GRID }, () => Array(GRID).fill("w") as Cell[]);

export default function CrossAirRadarGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("setup");
	const [tab, setTab] = useState<Tab>("fleet");

	// My fleet grid (my ships + opponent's attacks on me)
	const [fleet, setFleet] = useState<Cell[][]>(blank);
	// My attack grid (my attacks on opponent)
	const [radar, setRadar] = useState<Cell[][]>(blank);

	// Setup state
	const [shipIdx, setShipIdx] = useState(0);
	const [horiz, setHoriz] = useState(true);

	// Battle state
	const [selected, setSelected] = useState<[number, number] | null>(null);
	const [lastHitResult, setLastHitResult] = useState<string | null>(null);
	const [myHits, setMyHits] = useState(0);
	const [oppHits, setOppHits] = useState(0);
	const [winner, setWinner] = useState<"me" | "opp" | null>(null);



	const coord = (r: number, c: number) => `${COL[c]}${r + 1}`;

	// --- SETUP ---
	const tryPlace = useCallback(
		(r: number, c: number) => {
			if (shipIdx >= SHIPS.length) return;
			const size = SHIPS[shipIdx].size;

			const tryDir = (h: boolean): [number, number][] | null => {
				const cells: [number, number][] = [];
				for (let i = 0; i < size; i++) {
					const nr = h ? r : r + i;
					const nc = h ? c + i : c;
					if (nr >= GRID || nc >= GRID || fleet[nr][nc] === "s") return null;
					cells.push([nr, nc]);
				}
				return cells;
			};

			let cells = tryDir(horiz);
			if (!cells) cells = tryDir(!horiz);
			if (!cells) {
				haptic.error();
				return;
			}

			const next = fleet.map((row) => [...row]) as Cell[][];
			for (const [rr, cc] of cells) next[rr][cc] = "s";
			setFleet(next);
			setShipIdx((i) => i + 1);
			haptic.tap();
		},
		[shipIdx, horiz, fleet, haptic],
	);

	const resetSetup = () => {
		setFleet(blank());
		setShipIdx(0);
		setHoriz(true);
	};

	// --- BATTLE: opponent attacks me ---
	const handleFleetTap = useCallback(
		(r: number, c: number) => {
			const cell = fleet[r][c];
			if (cell === "h" || cell === "m") return;
			const isHit = cell === "s";
			const next = fleet.map((row) => [...row]) as Cell[][];
			next[r][c] = isHit ? "h" : "m";
			setFleet(next);

			setLastHitResult(isHit ? `💥 ${t("arHit")}` : `💨 ${t("arMiss")}`);
			(isHit ? haptic.error() : haptic.tap());

			if (isHit) {
				const ns = oppHits + 1;
				setOppHits(ns);
				if (ns >= TOTAL_HP) {
					setWinner("opp");
					setPhase("done");
					updateProgress("cross-air-radar", myHits * 10);
				}
			}
			setTimeout(() => setLastHitResult(null), 2500);
		},
		[fleet, oppHits, myHits, haptic, t, updateProgress],
	);

	// --- BATTLE: I attack opponent ---
	const handleRadarTap = useCallback(
		(r: number, c: number) => {
			if (radar[r][c] !== "w") return;
			setSelected([r, c]);
			haptic.tap();
		},
		[radar, haptic],
	);

	const markResult = useCallback(
		(hit: boolean) => {
			if (!selected) return;
			const [r, c] = selected;
			const next = radar.map((row) => [...row]) as Cell[][];
			next[r][c] = hit ? "h" : "m";
			setRadar(next);
			setSelected(null);
			(hit ? haptic.success() : haptic.tap());

			if (hit) {
				const ns = myHits + 1;
				setMyHits(ns);
				if (ns >= TOTAL_HP) {
					setWinner("me");
					setPhase("done");
					updateProgress("cross-air-radar", ns * 10);
				}
			}
		},
		[selected, radar, myHits, haptic, updateProgress],
	);

	const restart = () => {
		setPhase("setup");
		setFleet(blank());
		setRadar(blank());
		setTab("fleet");
		setShipIdx(0);
		setHoriz(true);
		setSelected(null);
		setLastHitResult(null);
		setMyHits(0);
		setOppHits(0);
		setWinner(null);
	};

	// --- RENDER GRID ---
	const renderGrid = (
		grid: Cell[][],
		onTap: (r: number, c: number) => void,
		showShips: boolean,
	) => (
		<View style={styles.gridWrap}>
			<View style={styles.gridRow}>
				<View style={[styles.labelCell, { width: CELL, height: CELL }]} />
				{COL.split("").map((l) => (
					<View
						key={l}
						style={[styles.labelCell, { width: CELL, height: CELL }]}
					>
						<Text style={[styles.labelText, { color: theme.mutedText }]}>
							{l}
						</Text>
					</View>
				))}
			</View>
			{grid.map((row, r) => (
				<View key={r} style={styles.gridRow}>
					<View style={[styles.labelCell, { width: CELL, height: CELL }]}>
						<Text style={[styles.labelText, { color: theme.mutedText }]}>
							{r + 1}
						</Text>
					</View>
					{row.map((cell, c) => {
						let bg = theme.card;
						let content: string | null = null;
						let contentColor = "#fff";

						if (showShips && cell === "s") bg = "#546e7a";
						if (cell === "h") {
							bg = "#ef5350";
							content = "✕";
						}
						if (cell === "m") {
							bg = theme.card;
							content = "•";
							contentColor = theme.mutedText;
						}

						const isSel = selected && selected[0] === r && selected[1] === c;

						return (
							<Pressable
								key={c}
								onPress={() => onTap(r, c)}
								style={[
									styles.cell,
									{
										width: CELL,
										height: CELL,
										backgroundColor: bg,
										borderColor: isSel ? theme.tint : theme.border,
										borderWidth: isSel ? 2.5 : 1,
									},
								]}
							>
								{content && (
									<Text style={[styles.cellContent, { color: contentColor }]}>
										{content}
									</Text>
								)}
							</Pressable>
						);
					})}
				</View>
			))}
		</View>
	);

	// --- PHASE: SETUP ---
	if (phase === "setup") {
		const allPlaced = shipIdx >= SHIPS.length;
		return (
			<View style={styles.container}>
				<Animated.View entering={FadeInDown.duration(300)}>
					<Text style={styles.title}>{t("arSetupTitle")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("arSetupHint")}
					</Text>
				</Animated.View>

				{!allPlaced && (
					<Animated.View
						entering={FadeInDown.delay(100).duration(300)}
						style={styles.shipTray}
					>
						{SHIPS.map((ship, i) => (
							<View
								key={ship.id}
								style={[
									styles.shipChip,
									{
										backgroundColor:
											i < shipIdx
												? theme.mutedText
												: i === shipIdx
													? theme.tint
													: theme.card,
										borderColor: theme.border,
									},
								]}
							>
								<Text
									style={[
										styles.shipChipText,
										{ color: i === shipIdx ? "#fff" : theme.text },
									]}
								>
									{t(SHIP_LABELS[ship.id])}{" "}
									({ship.size})
								</Text>
							</View>
						))}

						<Pressable
							onPress={() => setHoriz((h) => !h)}
							style={[
								styles.rotateBtn,
								{ backgroundColor: theme.card, borderColor: theme.border },
							]}
						>
							<Text style={styles.rotateBtnText}>
								{horiz ? "→" : "↓"} {t("arRotate")}
							</Text>
						</Pressable>
					</Animated.View>
				)}

				{renderGrid(fleet, allPlaced ? () => {} : tryPlace, true)}

				<View style={styles.setupActions}>
					{allPlaced ? (
						<Pressable
							onPress={() => setPhase("battle")}
							style={[styles.primaryBtn, { backgroundColor: theme.tint }]}
						>
							<Text style={styles.primaryBtnText}>{t("arReady")}</Text>
						</Pressable>
					) : null}
					<Pressable onPress={resetSetup}>
						<Text style={[styles.linkText, { color: theme.tint }]}>
							{t("arReset")}
						</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	// --- PHASE: DONE ---
	if (phase === "done") {
		return (
			<GameResult
				title={winner === "me" ? t("arYouWin") : t("arYouLose")}
				score={myHits * 10}
				subtitle={`${t("arHitsGiven")}: ${myHits} · ${t("arHitsTaken")}: ${oppHits}`}
				onPlayAgain={restart}
			/>
		);
	}

	// --- PHASE: BATTLE ---
	return (
		<View style={styles.container}>
			{/* Tab bar */}
			<View style={styles.tabBar}>
				{(["fleet", "radar"] as Tab[]).map((tb) => (
					<Pressable
						key={tb}
						onPress={() => {
							setTab(tb);
							setSelected(null);
						}}
						style={[
							styles.tabBtn,
							{
								backgroundColor: tab === tb ? theme.tint : theme.card,
								borderColor: tab === tb ? theme.tint : theme.border,
							},
						]}
					>
						<Text
							style={[
								styles.tabBtnText,
								{ color: tab === tb ? "#fff" : theme.text },
							]}
						>
							{tb === "fleet" ? t("arMyFleet") : t("arAttackMap")}
						</Text>
					</Pressable>
				))}
			</View>

			{/* Scoreboard */}
			<View style={styles.scoreboard}>
				<Text style={[styles.scoreText, { color: theme.mutedText }]}>
					{t("arHitsGiven")}: {myHits}/{TOTAL_HP}
				</Text>
				<Text style={[styles.scoreText, { color: theme.mutedText }]}>
					{t("arHitsTaken")}: {oppHits}/{TOTAL_HP}
				</Text>
			</View>

			{/* Flash result for fleet defense */}
			{lastHitResult && tab === "fleet" && (
				<Animated.View
					entering={ZoomIn.duration(200)}
					style={styles.flashBadge}
				>
					<Text style={styles.flashBadgeText}>{lastHitResult}</Text>
				</Animated.View>
			)}

			{/* Grid */}
			{tab === "fleet"
				? renderGrid(fleet, handleFleetTap, true)
				: renderGrid(radar, handleRadarTap, false)}

			{/* Attack controls */}
			{tab === "radar" && selected && (
				<Animated.View
					entering={FadeInDown.duration(200)}
					style={styles.attackControls}
				>
					<Text style={styles.coordBadge}>
						{coord(selected[0], selected[1])}
					</Text>
					<Text style={[styles.announceHint, { color: theme.mutedText }]}>
						{t("arAnnounce")}
					</Text>
					<View style={styles.hitMissRow}>
						<Pressable
							onPress={() => markResult(true)}
							style={[styles.hitBtn, { backgroundColor: "#ef5350" }]}
						>
							<Text style={styles.hitMissText}>{t("arTheyHit")}</Text>
						</Pressable>
						<Pressable
							onPress={() => markResult(false)}
							style={[styles.missBtn, { backgroundColor: "#78909c" }]}
						>
							<Text style={styles.hitMissText}>{t("arTheyMiss")}</Text>
						</Pressable>
					</View>
				</Animated.View>
			)}

			{/* Fleet defense hint */}
			{tab === "fleet" && (
				<Text style={[styles.defHint, { color: theme.mutedText }]}>
					{t("arDefenseHint")}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "center", paddingTop: 8 },
	title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
	subtitle: {
		fontSize: 14,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 8,
	},
	// Ship tray
	shipTray: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		justifyContent: "center",
		marginBottom: 10,
	},
	shipChip: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		borderWidth: 1,
	},
	shipChipText: { fontSize: 13, fontWeight: "600" },
	rotateBtn: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		borderWidth: 1,
	},
	rotateBtnText: { fontSize: 13, fontWeight: "700" },
	// Setup actions
	setupActions: { alignItems: "center", gap: 10, marginTop: 12 },
	primaryBtn: {
		paddingHorizontal: 32,
		paddingVertical: 12,
		borderRadius: 12,
	},
	primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
	linkText: { fontSize: 14, fontWeight: "600" },
	// Grid
	gridWrap: { marginTop: 4 },
	gridRow: { flexDirection: "row" },
	labelCell: { alignItems: "center", justifyContent: "center" },
	labelText: { fontSize: 11, fontWeight: "700" },
	cell: { borderRadius: 3, alignItems: "center", justifyContent: "center" },
	cellContent: { fontSize: 16, fontWeight: "800" },
	// Tab bar
	tabBar: {
		flexDirection: "row",
		gap: 10,
		marginBottom: 6,
	},
	tabBtn: {
		flex: 1,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: "center",
	},
	tabBtnText: { fontSize: 14, fontWeight: "700" },
	// Scoreboard
	scoreboard: {
		flexDirection: "row",
		gap: 20,
		marginBottom: 4,
	},
	scoreText: { fontSize: 13, fontWeight: "600" },
	// Flash badge
	flashBadge: {
		backgroundColor: "rgba(0,0,0,0.7)",
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 10,
		marginBottom: 4,
	},
	flashBadgeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
	// Attack controls
	attackControls: { alignItems: "center", marginTop: 10, gap: 6 },
	coordBadge: { fontSize: 28, fontWeight: "900" },
	announceHint: { fontSize: 13 },
	hitMissRow: { flexDirection: "row", gap: 12, marginTop: 4 },
	hitBtn: {
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 10,
	},
	missBtn: {
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 10,
	},
	hitMissText: { color: "#fff", fontSize: 15, fontWeight: "700" },
	// Defense hint
	defHint: {
		fontSize: 13,
		textAlign: "center",
		marginTop: 10,
		paddingHorizontal: 24,
	},
});
