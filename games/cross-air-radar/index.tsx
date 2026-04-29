import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import { useRef, useState } from "react";
import {
	Dimensions,
	type GestureResponderEvent,
	Pressable,
	StyleSheet,
} from "react-native";
import Animated, {
	FadeInDown,
	SlideInRight,
	ZoomIn,
} from "react-native-reanimated";

const GRID = 8;
const { width: SW } = Dimensions.get("window");
const CELL = Math.floor((SW - 52) / (GRID + 1));

const SHIPS = [
	{ id: "scout", size: 2 },
	{ id: "fighter", size: 3 },
	{ id: "bomber", size: 4 },
] as const;
const TOTAL_HP = 9; // 2+3+4

type ShipId = (typeof SHIPS)[number]["id"];
type ShipPlacement = { id: ShipId; cells: [number, number][] };
type GridDragHandlers = {
	canStart: (r: number, c: number) => boolean;
	onStart: (r: number, c: number) => void;
	onDrop: (r: number, c: number) => void;
};

const SHIP_LABELS: Record<string, TranslationKey> = {
	scout: "arShipScout",
	fighter: "arShipFighter",
	bomber: "arShipBomber",
};

type Cell = "w" | "s" | "h" | "m"; // water, ship, hit, miss
type Phase =
	| "setup1"
	| "pass1"
	| "setup2"
	| "pass2"
	| "turn"
	| "passAttack"
	| "done";

const COL = "ABCDEFGH";
const ROW = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const blank = (): Cell[][] =>
	Array.from({ length: GRID }, () => Array(GRID).fill("w") as Cell[]);

function cloneGrid(g: Cell[][]): Cell[][] {
	return g.map((row) => [...row]);
}

function gridFromPlacements(placements: ShipPlacement[]): Cell[][] {
	const grid = blank();
	for (const placement of placements) {
		for (const [r, c] of placement.cells) {
			grid[r][c] = "s";
		}
	}
	return grid;
}

function sameCoord(a: [number, number], b: [number, number]) {
	return a[0] === b[0] && a[1] === b[1];
}

function cellFromGridEvent(
	event: GestureResponderEvent,
): [number, number] | null {
	const x = event.nativeEvent.locationX - CELL;
	const y = event.nativeEvent.locationY - CELL;
	const c = Math.floor(x / CELL);
	const r = Math.floor(y / CELL);
	if (r < 0 || c < 0 || r >= GRID || c >= GRID) return null;
	return [r, c];
}

export default function CrossAirRadarGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [phase, setPhase] = useState<Phase>("setup1");
	const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);

	// Each player's fleet (ships placed) and attack grid (shots fired at opponent)
	const [fleet1, setFleet1] = useState<Cell[][]>(blank);
	const [fleet2, setFleet2] = useState<Cell[][]>(blank);
	const [placements1, setPlacements1] = useState<ShipPlacement[]>([]);
	const [placements2, setPlacements2] = useState<ShipPlacement[]>([]);
	const [attacks1, setAttacks1] = useState<Cell[][]>(blank); // P1's shots on P2
	const [attacks2, setAttacks2] = useState<Cell[][]>(blank); // P2's shots on P1

	// Setup state
	const [shipIdx, setShipIdx] = useState(0);
	const [horiz, setHoriz] = useState(true);
	const [selectedShip, setSelectedShip] = useState<ShipId | null>(null);
	const draggedShipRef = useRef<ShipId | null>(null);

	// Battle state
	const [hitsP1, setHitsP1] = useState(0); // how many P1 landed on P2
	const [hitsP2, setHitsP2] = useState(0); // how many P2 landed on P1
	const [lastResult, setLastResult] = useState<string | null>(null);
	const [winner, setWinner] = useState<1 | 2 | null>(null);

	const coord = (r: number, c: number) => `${COL[c]}${r + 1}`;

	const activeFleet = currentPlayer === 1 ? fleet1 : fleet2;
	const setActiveFleet = currentPlayer === 1 ? setFleet1 : setFleet2;
	const activePlacements = currentPlayer === 1 ? placements1 : placements2;
	const setActivePlacements =
		currentPlayer === 1 ? setPlacements1 : setPlacements2;

	// --- SETUP: place ships ---
	const buildPlacementCells = (
		r: number,
		c: number,
		size: number,
		existingPlacements: ShipPlacement[],
	): [number, number][] | null => {
		const occupied = new Set(
			existingPlacements.flatMap((placement) =>
				placement.cells.map(([rr, cc]) => `${rr}:${cc}`),
			),
		);

		const tryDir = (h: boolean): [number, number][] | null => {
			const cells: [number, number][] = [];
			for (let i = 0; i < size; i++) {
				const nr = h ? r : r + i;
				const nc = h ? c + i : c;
				if (nr >= GRID || nc >= GRID || occupied.has(`${nr}:${nc}`)) {
					return null;
				}
				cells.push([nr, nc]);
			}
			return cells;
		};

		let cells = tryDir(horiz);
		if (!cells) {
			cells = tryDir(!horiz);
		}
		return cells;
	};

	const getPlacementAt = (r: number, c: number) =>
		activePlacements.find((item) =>
			item.cells.some((cell) => sameCoord(cell, [r, c])),
		);

	const selectShipAt = (r: number, c: number) => {
		const placement = getPlacementAt(r, c);
		if (!placement) return false;
		setSelectedShip((current) =>
			current === placement.id ? null : placement.id,
		);
		haptic.tap();
		return true;
	};

	const startShipDrag = (r: number, c: number) => {
		const placement = getPlacementAt(r, c);
		if (!placement) return;
		draggedShipRef.current = placement.id;
		setSelectedShip(placement.id);
		haptic.tap();
	};

	const dropShipDrag = (r: number, c: number) => {
		const draggedShip = draggedShipRef.current;
		if (draggedShip) {
			moveShip(draggedShip, r, c);
		}
	};

	const moveShip = (shipId: ShipId, r: number, c: number) => {
		const ship = SHIPS.find((item) => item.id === shipId);
		if (!ship) return false;

		const others = activePlacements.filter((item) => item.id !== shipId);
		const cells = buildPlacementCells(r, c, ship.size, others);
		if (!cells) {
			haptic.error();
			return true;
		}

		const nextPlacements = [...others, { id: shipId, cells }];
		setActivePlacements(nextPlacements);
		setActiveFleet(gridFromPlacements(nextPlacements));
		setSelectedShip(null);
		draggedShipRef.current = null;
		haptic.success();
		return true;
	};

	const tryMoveSelected = (r: number, c: number) => {
		if (!selectedShip) return false;
		return moveShip(selectedShip, r, c);
	};

	const tryPlace = (r: number, c: number) => {
		if (selectedShip && tryMoveSelected(r, c)) return;
		if (selectShipAt(r, c)) return;
		if (shipIdx >= SHIPS.length) return;

		const ship = SHIPS[shipIdx];
		const cells = buildPlacementCells(r, c, ship.size, activePlacements);
		if (!cells) {
			haptic.error();
			return;
		}

		const nextPlacements = [...activePlacements, { id: ship.id, cells }];
		setActivePlacements(nextPlacements);
		setActiveFleet(gridFromPlacements(nextPlacements));
		setShipIdx((i) => i + 1);
		haptic.tap();
	};

	const resetSetup = () => {
		setActiveFleet(blank());
		setActivePlacements([]);
		setShipIdx(0);
		setHoriz(true);
		setSelectedShip(null);
		draggedShipRef.current = null;
	};

	const confirmSetup = () => {
		if (phase === "setup1") {
			setShipIdx(0);
			setHoriz(true);
			setSelectedShip(null);
			draggedShipRef.current = null;
			setPhase("pass1");
		} else if (phase === "setup2") {
			setShipIdx(0);
			setHoriz(true);
			setSelectedShip(null);
			draggedShipRef.current = null;
			setCurrentPlayer(1);
			setPhase("pass2");
		}
	};

	const handlePassDone = () => {
		if (phase === "pass1") {
			setCurrentPlayer(2);
			setPhase("setup2");
		} else if (phase === "pass2") {
			setCurrentPlayer(1);
			setPhase("turn");
		} else if (phase === "passAttack") {
			setPhase("turn");
		}
	};

	// --- BATTLE: fire ---
	const handleFire = (r: number, c: number) => {
		const attackGrid = currentPlayer === 1 ? attacks1 : attacks2;
		const setAttackGrid = currentPlayer === 1 ? setAttacks1 : setAttacks2;
		const opponentFleet = currentPlayer === 1 ? fleet2 : fleet1;

		if (attackGrid[r][c] !== "w") return;

		const isHit = opponentFleet[r][c] === "s";
		const next = cloneGrid(attackGrid);
		next[r][c] = isHit ? "h" : "m";
		setAttackGrid(next);

		if (isHit) {
			haptic.success();
			setLastResult(`💥 ${t("arHit")} — ${coord(r, c)}`);
			const setHits = currentPlayer === 1 ? setHitsP1 : setHitsP2;
			const currentHits = currentPlayer === 1 ? hitsP1 : hitsP2;
			const newHits = currentHits + 1;
			setHits(newHits);
			if (newHits >= TOTAL_HP) {
				setWinner(currentPlayer);
				updateProgress("cross-air-radar", newHits * 10);
				setPhase("done");
				return;
			}
		} else {
			haptic.tap();
			setLastResult(`\u{1F4A8} ${t("arMiss")} — ${coord(r, c)}`);
		}

		// Switch turns after a short delay
		setTimeout(() => {
			setLastResult(null);
			const nextP = currentPlayer === 1 ? 2 : 1;
			setCurrentPlayer(nextP as 1 | 2);
			setPhase("passAttack");
		}, 1500);
	};

	const restart = () => {
		setPhase("setup1");
		setCurrentPlayer(1);
		setFleet1(blank());
		setFleet2(blank());
		setPlacements1([]);
		setPlacements2([]);
		setAttacks1(blank());
		setAttacks2(blank());
		setShipIdx(0);
		setHoriz(true);
		setSelectedShip(null);
		draggedShipRef.current = null;
		setHitsP1(0);
		setHitsP2(0);
		setLastResult(null);
		setWinner(null);
	};

	// --- RENDER GRID ---
	const renderGrid = (
		grid: Cell[][],
		onTap: (r: number, c: number) => void,
		showShips: boolean,
		selectedCells: [number, number][] = [],
		dragHandlers?: GridDragHandlers,
	) => (
		<View
			style={styles.gridWrap}
			onStartShouldSetResponderCapture={(event) => {
				const cell = cellFromGridEvent(event);
				return cell ? Boolean(dragHandlers?.canStart(cell[0], cell[1])) : false;
			}}
			onMoveShouldSetResponderCapture={() => Boolean(draggedShipRef.current)}
			onResponderGrant={(event) => {
				const cell = cellFromGridEvent(event);
				if (cell) dragHandlers?.onStart(cell[0], cell[1]);
			}}
			onResponderRelease={(event) => {
				const cell = cellFromGridEvent(event);
				if (cell) {
					dragHandlers?.onDrop(cell[0], cell[1]);
				} else {
					draggedShipRef.current = null;
				}
			}}
			onResponderTerminate={() => {
				draggedShipRef.current = null;
			}}
		>
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
			{ROW.map((rowLabel) => {
				const r = Number(rowLabel) - 1;
				const row = grid[r];

				return (
					<View key={`row-${rowLabel}`} style={styles.gridRow}>
						<View style={[styles.labelCell, { width: CELL, height: CELL }]}>
							<Text style={[styles.labelText, { color: theme.mutedText }]}>
								{rowLabel}
							</Text>
						</View>
						{COL.split("").map((colLabel) => {
							const c = COL.indexOf(colLabel);
							const cell = row[c];
							const isSelected = selectedCells.some((coord) =>
								sameCoord(coord, [r, c]),
							);
							let bg = theme.card;
							let content: string | null = null;
							let contentColor = "#fff";

							if (showShips && cell === "s") bg = "#546e7a";
							if (isSelected) bg = theme.tint;
							if (cell === "h") {
								bg = "#ef5350";
								content = "✕";
							}
							if (cell === "m") {
								bg = theme.card;
								content = "•";
								contentColor = theme.mutedText;
							}

							return (
								<Pressable
									key={colLabel}
									onPress={() => onTap(r, c)}
									style={[
										styles.cell,
										{
											width: CELL,
											height: CELL,
											backgroundColor: bg,
											borderColor: theme.border,
											borderWidth: 1,
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
				);
			})}
		</View>
	);

	// --- PASS SCREEN ---
	if (phase === "pass1" || phase === "pass2" || phase === "passAttack") {
		const nextPlayer =
			phase === "pass1" ? 2 : phase === "pass2" ? 1 : currentPlayer;
		return (
			<View style={styles.container}>
				<Animated.View
					entering={SlideInRight.duration(260)}
					style={styles.passScreen}
				>
					<Text style={{ fontSize: 48, marginBottom: 16 }}>🎮</Text>
					<Text style={styles.title}>{t("passPhone")}</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("passPhoneTo", {
							player: t("mpPlayerN", { n: nextPlayer }),
						})}
					</Text>
					<Text
						style={[styles.subtitle, { color: theme.mutedText, marginTop: 4 }]}
					>
						{t("passPhoneDontLook")}
					</Text>
					<Pressable
						onPress={handlePassDone}
						style={[
							styles.primaryBtn,
							{ backgroundColor: theme.tint, marginTop: 32 },
						]}
					>
						<Text style={styles.primaryBtnText}>{t("passPhoneReady")}</Text>
					</Pressable>
				</Animated.View>
			</View>
		);
	}

	// --- SETUP ---
	if (phase === "setup1" || phase === "setup2") {
		const playerNum = phase === "setup1" ? 1 : 2;
		const allPlaced = activePlacements.length >= SHIPS.length;
		const selectedCells =
			activePlacements.find((placement) => placement.id === selectedShip)
				?.cells ?? [];
		return (
			<View style={styles.container}>
				<Animated.View entering={FadeInDown.duration(300)}>
					<Text style={styles.title}>
						{t("mpPlayerN", { n: playerNum })} {"—"} {t("arSetupTitle")}
					</Text>
					<Text style={[styles.subtitle, { color: theme.mutedText }]}>
						{t("arSetupHint")}
					</Text>
				</Animated.View>

				<Animated.View
					entering={FadeInDown.delay(100).duration(300)}
					style={styles.shipTray}
				>
					{SHIPS.map((ship, i) => {
						const isPlaced = activePlacements.some(
							(placement) => placement.id === ship.id,
						);
						const isSelected = selectedShip === ship.id;
						const isCurrent = !allPlaced && i === shipIdx;
						return (
							<Pressable
								key={ship.id}
								onPress={() => {
									if (isPlaced) {
										setSelectedShip((current) =>
											current === ship.id ? null : ship.id,
										);
										haptic.tap();
									}
								}}
								style={[
									styles.shipChip,
									{
										backgroundColor: isSelected
											? theme.tint
											: isPlaced
												? theme.surface
												: isCurrent
													? theme.tint
													: theme.card,
										borderColor: isSelected ? theme.tint : theme.border,
									},
								]}
							>
								<Text
									style={[
										styles.shipChipText,
										{ color: isSelected || isCurrent ? "#fff" : theme.text },
									]}
								>
									{t(SHIP_LABELS[ship.id])} ({ship.size})
								</Text>
							</Pressable>
						);
					})}

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

				{renderGrid(activeFleet, tryPlace, true, selectedCells, {
					canStart: (r, c) => Boolean(getPlacementAt(r, c)),
					onStart: startShipDrag,
					onDrop: dropShipDrag,
				})}

				<View style={styles.setupActions}>
					{allPlaced ? (
						<Pressable
							onPress={confirmSetup}
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

	// --- DONE ---
	if (phase === "done") {
		const winLabel = winner === 1 ? t("c4Player1") : t("c4Player2");
		return (
			<GameResult
				title={t("arPlayerWins", { player: winLabel })}
				score={Math.max(hitsP1, hitsP2) * 10}
				subtitle={`${t("c4Player1")}: ${hitsP1} · ${t("c4Player2")}: ${hitsP2}`}
				onPlayAgain={restart}
			/>
		);
	}

	// --- BATTLE TURN ---
	const attackGrid = currentPlayer === 1 ? attacks1 : attacks2;
	const playerLabel = currentPlayer === 1 ? t("c4Player1") : t("c4Player2");

	return (
		<View style={styles.container}>
			{/* Header */}
			<Animated.View entering={FadeInDown.duration(200)}>
				<Text style={styles.title}>
					{t("arTurnTitle", { player: playerLabel })}
				</Text>
			</Animated.View>

			{/* Scoreboard */}
			<View style={styles.scoreboard}>
				<Text style={[styles.scoreText, { color: "#ef5350" }]}>
					{t("c4Player1")}: {hitsP1}/{TOTAL_HP}
				</Text>
				<Text style={[styles.scoreText, { color: "#ffd54f" }]}>
					{t("c4Player2")}: {hitsP2}/{TOTAL_HP}
				</Text>
			</View>

			{/* Flash result */}
			{lastResult && (
				<Animated.View
					entering={ZoomIn.duration(200)}
					style={styles.flashBadge}
				>
					<Text style={styles.flashBadgeText}>{lastResult}</Text>
				</Animated.View>
			)}

			{/* Attack hint */}
			{!lastResult && (
				<Text style={[styles.attackHint, { color: theme.mutedText }]}>
					{t("arTapToFire")}
				</Text>
			)}

			{/* Attack grid (opponent's waters) */}
			{renderGrid(attackGrid, lastResult ? () => {} : handleFire, false)}
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
	passScreen: { alignItems: "center", paddingTop: 40 },
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
	// Scoreboard
	scoreboard: {
		flexDirection: "row",
		gap: 20,
		marginBottom: 6,
		marginTop: 4,
	},
	scoreText: { fontSize: 13, fontWeight: "700" },
	// Flash badge
	flashBadge: {
		backgroundColor: "rgba(0,0,0,0.7)",
		paddingHorizontal: 20,
		paddingVertical: 8,
		borderRadius: 10,
		marginBottom: 4,
	},
	flashBadgeText: { color: "#fff", fontSize: 18, fontWeight: "800" },
	// Attack hint
	attackHint: { fontSize: 13, marginBottom: 6 },
});
