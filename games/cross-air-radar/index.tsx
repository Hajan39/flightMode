import { useEffect, useRef, useState } from "react";
import {
	type GestureResponderEvent,
	Pressable,
	View as RNView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import {
	MatchResult,
	PassDeviceOverlay,
	PlayerScoreStrip,
	PlayerSetup,
	TurnBanner,
} from "@/components/multiplayer";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import type { MatchPlayer } from "@/hooks/useMatchPlayers";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import type { GameProgressUpdate } from "@/types/game";
import { recordMatch } from "@/utils/multiplayerScoring";

const GAME_ID = "cross-air-radar";
const GRID = 8;

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
type Seat = 0 | 1;
type Phase =
	| "players"
	| "setup" // active seat places ships
	| "passSetup" // hand to the other seat for their setup
	| "passBattle" // hand to the seat whose turn it is
	| "turn"
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
		for (const [r, c] of placement.cells) grid[r][c] = "s";
	}
	return grid;
}

function sameCoord(a: [number, number], b: [number, number]) {
	return a[0] === b[0] && a[1] === b[1];
}

function isShipSunk(attackGrid: Cell[][], placement: ShipPlacement) {
	return placement.cells.every(([r, c]) => attackGrid[r][c] === "h");
}

function remainingShips(attackGrid: Cell[][], placements: ShipPlacement[]) {
	return placements.filter((placement) => !isShipSunk(attackGrid, placement)).length;
}

export default function CrossAirRadarGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width } = useWindowDimensions();
	const cell = Math.floor((Math.min(width, 520) - 52) / (GRID + 1));

	const [players, setPlayers] = useState<MatchPlayer[]>([]);
	const [phase, setPhase] = useState<Phase>("players");
	const [currentSeat, setCurrentSeat] = useState<Seat>(0);

	// Per seat: fleet grid, placements, and shots fired at the opponent.
	const [fleets, setFleets] = useState<[Cell[][], Cell[][]]>([blank(), blank()]);
	const [placements, setPlacements] = useState<[ShipPlacement[], ShipPlacement[]]>([[], []]);
	const [attacks, setAttacks] = useState<[Cell[][], Cell[][]]>([blank(), blank()]);
	const [hits, setHits] = useState<[number, number]>([0, 0]);

	// Setup state
	const [shipIdx, setShipIdx] = useState(0);
	const [horiz, setHoriz] = useState(true);
	const [selectedShip, setSelectedShip] = useState<ShipId | null>(null);
	const draggedShipRef = useRef<ShipId | null>(null);
	const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [lastResult, setLastResult] = useState<string | null>(null);
	const [winner, setWinner] = useState<Seat | null>(null);
	const [progress, setProgress] = useState<GameProgressUpdate | undefined>();

	useEffect(() => {
		return () => {
			if (turnTimer.current) clearTimeout(turnTimer.current);
		};
	}, []);

	const coord = (r: number, c: number) => `${COL[c]}${r + 1}`;
	const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

	const setSeatFleet = (seat: Seat, grid: Cell[][]) =>
		setFleets((prev) => (seat === 0 ? [grid, prev[1]] : [prev[0], grid]));
	const setSeatPlacements = (seat: Seat, list: ShipPlacement[]) =>
		setPlacements((prev) => (seat === 0 ? [list, prev[1]] : [prev[0], list]));

	const activePlacements = placements[currentSeat];

	const cellFromGridEvent = (event: GestureResponderEvent): [number, number] | null => {
		const x = event.nativeEvent.locationX - cell;
		const y = event.nativeEvent.locationY - cell;
		const c = Math.floor(x / cell);
		const r = Math.floor(y / cell);
		if (r < 0 || c < 0 || r >= GRID || c >= GRID) return null;
		return [r, c];
	};

	// --- SETUP: place ships ---
	const buildPlacementCells = (
		r: number,
		c: number,
		size: number,
		existing: ShipPlacement[],
	): [number, number][] | null => {
		const occupied = new Set(
			existing.flatMap((p) => p.cells.map(([rr, cc]) => `${rr}:${cc}`)),
		);
		const tryDir = (h: boolean): [number, number][] | null => {
			const cells: [number, number][] = [];
			for (let i = 0; i < size; i++) {
				const nr = h ? r : r + i;
				const nc = h ? c + i : c;
				if (nr >= GRID || nc >= GRID || occupied.has(`${nr}:${nc}`)) return null;
				cells.push([nr, nc]);
			}
			return cells;
		};
		return tryDir(horiz) ?? tryDir(!horiz);
	};

	const getPlacementAt = (r: number, c: number) =>
		activePlacements.find((item) => item.cells.some((x) => sameCoord(x, [r, c])));

	const selectShipAt = (r: number, c: number) => {
		const placement = getPlacementAt(r, c);
		if (!placement) return false;
		setSelectedShip((current) => (current === placement.id ? null : placement.id));
		haptic.tap();
		return true;
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
		const next = [...others, { id: shipId, cells }];
		setSeatPlacements(currentSeat, next);
		setSeatFleet(currentSeat, gridFromPlacements(next));
		setSelectedShip(null);
		draggedShipRef.current = null;
		haptic.success();
		return true;
	};

	const tryPlace = (r: number, c: number) => {
		if (selectedShip && moveShip(selectedShip, r, c)) return;
		if (selectShipAt(r, c)) return;
		if (shipIdx >= SHIPS.length) return;
		const ship = SHIPS[shipIdx];
		const cells = buildPlacementCells(r, c, ship.size, activePlacements);
		if (!cells) {
			haptic.error();
			return;
		}
		const next = [...activePlacements, { id: ship.id, cells }];
		setSeatPlacements(currentSeat, next);
		setSeatFleet(currentSeat, gridFromPlacements(next));
		setShipIdx((i) => i + 1);
		haptic.tap();
	};

	const resetSetupState = () => {
		setShipIdx(0);
		setHoriz(true);
		setSelectedShip(null);
		draggedShipRef.current = null;
	};

	const resetSetup = () => {
		setSeatFleet(currentSeat, blank());
		setSeatPlacements(currentSeat, []);
		resetSetupState();
	};

	const confirmSetup = () => {
		haptic.tap();
		resetSetupState();
		if (currentSeat === 0) {
			setCurrentSeat(1);
			setPhase("passSetup");
		} else {
			setCurrentSeat(0);
			setPhase("passBattle");
		}
	};

	const startMatch = (matchPlayers: MatchPlayer[]) => {
		if (turnTimer.current) clearTimeout(turnTimer.current);
		setPlayers(matchPlayers);
		setCurrentSeat(0);
		setFleets([blank(), blank()]);
		setPlacements([[], []]);
		setAttacks([blank(), blank()]);
		setHits([0, 0]);
		setLastResult(null);
		setWinner(null);
		setProgress(undefined);
		resetSetupState();
		setPhase("setup");
	};

	// --- BATTLE ---
	const handleFire = (r: number, c: number) => {
		const attackGrid = attacks[currentSeat];
		const opponent = other(currentSeat);
		if (attackGrid[r][c] !== "w") return;

		const isHit = fleets[opponent][r][c] === "s";
		const next = cloneGrid(attackGrid);
		next[r][c] = isHit ? "h" : "m";
		setAttacks((prev) => (currentSeat === 0 ? [next, prev[1]] : [prev[0], next]));

		if (isHit) {
			haptic.success();
			let resultText = `💥 ${t("arHit")} · ${coord(r, c)}`;
			const hitPlacement = placements[opponent].find((p) =>
				p.cells.some((x) => sameCoord(x, [r, c])),
			);
			if (hitPlacement && isShipSunk(next, hitPlacement)) {
				resultText = `🔥 ${t(SHIP_LABELS[hitPlacement.id])} ${t("arShipDown")}`;
			}
			setLastResult(resultText);
			const nextHits: [number, number] = [...hits] as [number, number];
			nextHits[currentSeat] += 1;
			setHits(nextHits);
			if (nextHits[currentSeat] >= TOTAL_HP) {
				setWinner(currentSeat);
				setProgress(
					recordMatch(
						GAME_ID,
						nextHits.map((h) => ({ score: h * 10 })),
						{ bonusIfWon: 10 },
					),
				);
				setPhase("done");
				return;
			}
		} else {
			haptic.tap();
			setLastResult(`💨 ${t("arMiss")} · ${coord(r, c)}`);
		}

		turnTimer.current = setTimeout(() => {
			turnTimer.current = null;
			setLastResult(null);
			setCurrentSeat(opponent);
			setPhase("passBattle");
		}, 1400);
	};

	const skipTurnDelay = () => {
		if (!turnTimer.current) return;
		clearTimeout(turnTimer.current);
		turnTimer.current = null;
		setLastResult(null);
		setCurrentSeat(other(currentSeat));
		setPhase("passBattle");
	};

	// --- RENDER GRID ---
	const renderGrid = (
		grid: Cell[][],
		onTap: (r: number, c: number) => void,
		showShips: boolean,
		ownerColor: string,
		selectedCells: [number, number][] = [],
		dragHandlers?: GridDragHandlers,
	) => (
		<RNView
			style={styles.gridWrap}
			onStartShouldSetResponderCapture={(event) => {
				const hit = cellFromGridEvent(event);
				return hit ? Boolean(dragHandlers?.canStart(hit[0], hit[1])) : false;
			}}
			onMoveShouldSetResponderCapture={() => Boolean(draggedShipRef.current)}
			onResponderGrant={(event) => {
				const hit = cellFromGridEvent(event);
				if (hit) dragHandlers?.onStart(hit[0], hit[1]);
			}}
			onResponderRelease={(event) => {
				const hit = cellFromGridEvent(event);
				if (hit) dragHandlers?.onDrop(hit[0], hit[1]);
				else draggedShipRef.current = null;
			}}
			onResponderTerminate={() => {
				draggedShipRef.current = null;
			}}
		>
			<RNView style={styles.gridRow}>
				<RNView style={[styles.labelCell, { width: cell, height: cell }]} />
				{COL.split("").map((l) => (
					<RNView key={l} style={[styles.labelCell, { width: cell, height: cell }]}>
						<Text style={[styles.labelText, { color: theme.mutedText }]}>{l}</Text>
					</RNView>
				))}
			</RNView>
			{ROW.map((rowLabel) => {
				const r = Number(rowLabel) - 1;
				const row = grid[r];
				return (
					<RNView key={`row-${rowLabel}`} style={styles.gridRow}>
						<RNView style={[styles.labelCell, { width: cell, height: cell }]}>
							<Text style={[styles.labelText, { color: theme.mutedText }]}>{rowLabel}</Text>
						</RNView>
						{COL.split("").map((colLabel) => {
							const c = COL.indexOf(colLabel);
							const value = row[c];
							const isSelected = selectedCells.some((x) => sameCoord(x, [r, c]));
							let bg = theme.card;
							let content: string | null = null;
							let contentColor = "#fff";
							if (showShips && value === "s") bg = ownerColor;
							if (isSelected) bg = theme.tint;
							if (value === "h") {
								bg = theme.danger;
								content = "✕";
							}
							if (value === "m") {
								bg = theme.card;
								content = "•";
								contentColor = theme.mutedText;
							}
							return (
								<Pressable
									key={colLabel}
									onPress={() => onTap(r, c)}
									accessibilityRole="button"
									accessibilityLabel={coord(r, c)}
									style={[
										styles.cell,
										{ width: cell, height: cell, backgroundColor: bg, borderColor: theme.border },
									]}
								>
									{content ? (
										<Animated.View entering={ZoomIn.duration(180)}>
											<Text style={[styles.cellContent, { color: contentColor }]}>{content}</Text>
										</Animated.View>
									) : null}
								</Pressable>
							);
						})}
					</RNView>
				);
			})}
		</RNView>
	);

	if (phase === "players") {
		return (
			<PlayerSetup
				title={t("gameCrossAirRadarName")}
				subtitle={t("arSetupHint")}
				fixedCount={2}
				onStart={startMatch}
			/>
		);
	}

	const me = players[currentSeat];
	const opponentSeat = other(currentSeat);

	// --- SETUP ---
	if (phase === "setup" || phase === "passSetup") {
		const allPlaced = activePlacements.length >= SHIPS.length;
		const selectedCells =
			activePlacements.find((p) => p.id === selectedShip)?.cells ?? [];
		return (
			<View style={styles.container}>
				<RNView style={styles.topRow}>
					<TurnBanner player={me} label={`${me.name} · ${t("arSetupTitle")}`} compact />
					<GameControls onReset={() => startMatch(players)} />
				</RNView>

				<Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.shipTray}>
					{SHIPS.map((ship, i) => {
						const isPlaced = activePlacements.some((p) => p.id === ship.id);
						const isSelected = selectedShip === ship.id;
						const isCurrent = !allPlaced && i === shipIdx;
						return (
							<Pressable
								key={ship.id}
								onPress={() => {
									if (isPlaced) {
										setSelectedShip((current) => (current === ship.id ? null : ship.id));
										haptic.tap();
									}
								}}
								accessibilityRole="button"
								accessibilityState={{ selected: isSelected }}
								style={[
									styles.shipChip,
									{
										backgroundColor: isSelected || isCurrent ? me.color : isPlaced ? theme.surface : theme.card,
										borderColor: isSelected || isCurrent ? me.color : theme.border,
									},
								]}
							>
								<Text
									style={[
										styles.shipChipText,
										{ color: isSelected || isCurrent ? "#0b1620" : theme.text },
									]}
								>
									{t(SHIP_LABELS[ship.id])} ({ship.size})
								</Text>
							</Pressable>
						);
					})}
					<Pressable
						onPress={() => {
							haptic.tap();
							setHoriz((h) => !h);
						}}
						accessibilityRole="button"
						accessibilityLabel={t("arRotate")}
						style={[styles.shipChip, { backgroundColor: theme.card, borderColor: theme.border }]}
					>
						<Text style={[styles.shipChipText, { color: theme.text }]}>
							{horiz ? "→" : "↓"} {t("arRotate")}
						</Text>
					</Pressable>
				</Animated.View>

				{renderGrid(fleets[currentSeat], tryPlace, true, me.color, selectedCells, {
					canStart: (r, c) => Boolean(getPlacementAt(r, c)),
					onStart: (r, c) => {
						const placement = getPlacementAt(r, c);
						if (!placement) return;
						draggedShipRef.current = placement.id;
						setSelectedShip(placement.id);
						haptic.tap();
					},
					onDrop: (r, c) => {
						const dragged = draggedShipRef.current;
						if (dragged) moveShip(dragged, r, c);
					},
				})}

				<RNView style={styles.setupActions}>
					{allPlaced ? (
						<Pressable
							onPress={confirmSetup}
							accessibilityRole="button"
							accessibilityLabel={t("arReady")}
							style={[styles.primaryBtn, { backgroundColor: me.color }]}
						>
							<Text style={styles.primaryBtnText}>{t("arReady")}</Text>
						</Pressable>
					) : null}
					<Pressable onPress={resetSetup} accessibilityRole="button" accessibilityLabel={t("arReset")}>
						<Text style={[styles.linkText, { color: theme.tint }]}>{t("arReset")}</Text>
					</Pressable>
				</RNView>

				<PassDeviceOverlay
					visible={phase === "passSetup"}
					toPlayer={me}
					secret
					hint={t("arSetupHint")}
					onReady={() => setPhase("setup")}
				/>
			</View>
		);
	}

	// --- BATTLE ---
	const attackGrid = attacks[currentSeat];
	const hitsToWin = Math.max(0, TOTAL_HP - hits[currentSeat]);
	const shipsToWin = remainingShips(attackGrid, placements[opponentSeat]);

	return (
		<View style={styles.container}>
			<RNView style={styles.topRow}>
				<TurnBanner player={me} label={t("arTurnTitle", { player: me.name })} compact />
				<GameControls onReset={() => startMatch(players)} />
			</RNView>

			<PlayerScoreStrip
				players={players}
				scores={hits}
				activeIndex={currentSeat}
				format={(v) => `${v}/${TOTAL_HP}`}
			/>

			<RNView style={styles.remainingRow}>
				<Text style={[styles.remainingText, { color: theme.mutedText }]}>🎯 {hitsToWin}</Text>
				<Text style={[styles.remainingText, { color: theme.mutedText }]}>✈️ {shipsToWin}</Text>
			</RNView>

			{lastResult ? (
				<Pressable onPress={skipTurnDelay} accessibilityRole="button">
					<Animated.View entering={ZoomIn.duration(200)} style={[styles.flashBadge, { backgroundColor: theme.elevated, borderColor: me.color }]}>
						<Text style={[styles.flashBadgeText, { color: theme.text }]}>{lastResult}</Text>
					</Animated.View>
				</Pressable>
			) : (
				<Text style={[styles.attackHint, { color: theme.mutedText }]}>{t("arTapToFire")}</Text>
			)}

			{renderGrid(attackGrid, lastResult ? () => {} : handleFire, false, me.color)}

			<PassDeviceOverlay
				visible={phase === "passBattle"}
				toPlayer={me}
				secret
				onReady={() => setPhase("turn")}
			/>

			{phase === "done" && winner !== null ? (
				<MatchResult
					standings={players.map((p, i) => ({
						player: p,
						score: hits[i],
						detail: `${SHIPS.length - remainingShips(attacks[i], placements[other(i as Seat)])} ✈️ ${t("arShipDown")}`,
					}))}
					winnerIndex={winner}
					scoreLabel={t("arHitsGiven")}
					progress={progress}
					onRematch={() => startMatch(players)}
					onChangePlayers={() => setPhase("players")}
				/>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: "stretch", paddingTop: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.sm },
	topRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
	shipTray: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
	shipChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.sm + 2, borderWidth: 1 },
	shipChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
	setupActions: { alignItems: "center", gap: Spacing.sm + 2, marginTop: Spacing.sm },
	primaryBtn: { paddingHorizontal: Spacing["4xl"], paddingVertical: Spacing.md, borderRadius: Radius.card },
	primaryBtnText: { ...TextStyle.buttonSecondary, color: "#0b1620" },
	linkText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
	gridWrap: { marginTop: Spacing.xs, alignSelf: "center" },
	gridRow: { flexDirection: "row" },
	labelCell: { alignItems: "center", justifyContent: "center" },
	labelText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
	cell: { borderRadius: 3, borderWidth: 1, alignItems: "center", justifyContent: "center" },
	cellContent: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold },
	remainingRow: { flexDirection: "row", gap: Spacing.lg, justifyContent: "center" },
	remainingText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
	flashBadge: { alignSelf: "center", borderWidth: 1.5, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: Radius.md },
	flashBadgeText: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
	attackHint: { ...TextStyle.hint, textAlign: "center" },
});
