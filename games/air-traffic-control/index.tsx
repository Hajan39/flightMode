import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, {
	FadeInDown,
	FadeOutLeft,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
	LinearTransition,
} from "react-native-reanimated";

import { Text, View } from "@/components/Themed";
import AnimatedPressable from "@/components/AnimatedPressable";
import GameResult from "@/components/GameResult";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";
import { useGameStore } from "@/store/useGameStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useHaptic } from "@/hooks/useHaptic";

type Runway = "A" | "B" | "C";

type Flight = {
	id: number;
	callsign: string;
	runway: Runway;
	fuel: number;
	maxFuel: number;
};

const RUNWAYS: Runway[] = ["A", "B", "C"];
const MAX_MISSES = 3;
const MAX_LEVEL = 6;

const RUNWAY_COLORS: Record<Runway, string> = {
	A: "#3b82f6",
	B: "#f59e0b",
	C: "#10b981",
};

function randomRunway(): Runway {
	return RUNWAYS[Math.floor(Math.random() * RUNWAYS.length)];
}

function createCallsign(id: number) {
	const prefixes = ["FM", "SKY", "JET", "AT", "AIR"];
	const prefix = prefixes[id % prefixes.length];
	return `${prefix}-${100 + (id % 900)}`;
}

function getLevel(landed: number) {
	return Math.min(MAX_LEVEL, Math.floor(landed / 5) + 1);
}

function getSpawnInterval(level: number) {
	return Math.max(1100, 4200 - (level - 1) * 500);
}

function getMaxQueueSize(level: number) {
	return Math.min(10, 5 + Math.floor(level / 2));
}

function getStartingFuel(level: number, id: number) {
	const baseFuel = Math.max(3, 7 - Math.floor((level - 1) / 2));
	return baseFuel + (id % 3);
}

function FuelBar({ fuel, maxFuel }: { fuel: number; maxFuel: number }) {
	const ratio = Math.max(0, fuel / maxFuel);
	const width = useSharedValue(ratio);

	useEffect(() => {
		width.value = withTiming(ratio, { duration: 600 });
	}, [ratio, width]);

	const barStyle = useAnimatedStyle(() => ({
		width: `${width.value * 100}%`,
		backgroundColor:
			ratio > 0.5 ? "#22c55e" : ratio > 0.25 ? "#f59e0b" : "#ef4444",
	}));

	return (
		<View style={styles.fuelTrack} lightColor="#e5e7eb" darkColor="#1f2937">
			<Animated.View style={[styles.fuelBar, barStyle]} />
		</View>
	);
}

function FlightCard({
	item,
	onAssign,
	theme,
	t,
}: {
	item: Flight;
	onAssign: (id: number, runway: Runway) => void;
	theme: (typeof Colors)[keyof typeof Colors];
	t: (key: string, params?: Record<string, string | number>) => string;
}) {
	const fuelRatio = item.fuel / item.maxFuel;
	const isCritical = fuelRatio <= 0.35;

	return (
		<Animated.View
			entering={FadeInDown.duration(220)}
			exiting={FadeOutLeft.duration(250)}
			layout={LinearTransition.duration(200)}
		>
			<View
				style={[
					styles.flightCard,
					{
						backgroundColor: theme.elevated,
						borderColor: isCritical ? "#ef4444" : theme.border,
					},
				]}
			>
				{/* Left accent bar colored by target runway */}
				<View
					style={[
						styles.runwayAccent,
						{ backgroundColor: RUNWAY_COLORS[item.runway] },
					]}
				/>

				<View style={styles.cardInner} lightColor="transparent" darkColor="transparent">
					{/* Top row: callsign + fuel label */}
					<View
						style={styles.flightTop}
						lightColor="transparent"
						darkColor="transparent"
					>
						<Text style={styles.callsign}>{item.callsign}</Text>
						<Text
							style={[
								styles.fuelText,
								{ color: isCritical ? "#ef4444" : theme.mutedText },
							]}
						>
							{t("atcFuel", { fuel: item.fuel })}
						</Text>
					</View>

					{/* Fuel bar */}
					<FuelBar fuel={item.fuel} maxFuel={item.maxFuel} />

					{/* Target runway label */}
					<View
						style={styles.targetRow}
						lightColor="transparent"
						darkColor="transparent"
					>
						<View
							style={[
								styles.targetBadge,
								{ backgroundColor: RUNWAY_COLORS[item.runway] + "22" },
							]}
							lightColor="transparent"
							darkColor="transparent"
						>
							<View
								style={[
									styles.targetDot,
									{ backgroundColor: RUNWAY_COLORS[item.runway] },
								]}
							/>
							<Text
								style={[
									styles.targetRunway,
									{ color: RUNWAY_COLORS[item.runway] },
								]}
							>
								{t("atcTargetRunway", { rwy: item.runway })}
							</Text>
						</View>
					</View>

					{/* Runway assignment buttons */}
					<View
						style={styles.runwayRow}
						lightColor="transparent"
						darkColor="transparent"
					>
						{RUNWAYS.map((runway) => {
							const isTarget = runway === item.runway;
							return (
								<AnimatedPressable
									key={runway}
									scaleTo={0.93}
									style={[
										styles.runwayChip,
										{
											backgroundColor: isTarget
												? `${RUNWAY_COLORS[runway]}22`
												: theme.card,
											borderColor: RUNWAY_COLORS[runway],
										},
									]}
									onPress={() => onAssign(item.id, runway)}
								>
									<Text
										style={[
											styles.runwayChipText,
											{ color: RUNWAY_COLORS[runway] },
										]}
									>
										{t("atcRwy", { rwy: runway })}
									</Text>
								</AnimatedPressable>
							);
						})}
					</View>
				</View>
			</View>
		</Animated.View>
	);
}

export default function AirTrafficControlGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const { t } = useTranslation();
	const haptic = useHaptic();

	const [flights, setFlights] = useState<Flight[]>([]);
	const [score, setScore] = useState(0);
	const [landed, setLanded] = useState(0);
	const [misses, setMisses] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const flightIdRef = useRef(1);
	const scoreRef = useRef(0);
	const missesRef = useRef(0);
	const level = getLevel(landed);

	useEffect(() => {
		scoreRef.current = score;
	}, [score]);

	useEffect(() => {
		missesRef.current = misses;
	}, [misses]);

	const spawnInterval = getSpawnInterval(level);
	const maxQueueSize = getMaxQueueSize(level);

	useEffect(() => {
		if (gameOver) return;

		const timer = setInterval(() => {
			setFlights((prev) => {
				if (prev.length >= maxQueueSize) return prev;
				const id = flightIdRef.current++;
				const startFuel = getStartingFuel(level, id);
				return [
					...prev,
					{
						id,
						callsign: createCallsign(id),
						runway: randomRunway(),
						fuel: startFuel,
						maxFuel: startFuel,
					},
				];
			});
		}, spawnInterval);

		return () => clearInterval(timer);
	}, [gameOver, spawnInterval, maxQueueSize, level]);

	useEffect(() => {
		if (gameOver) return;

		const timer = setInterval(() => {
			setFlights((prev) => {
				let lostThisTick = 0;
				const nextFlights: Flight[] = [];

				for (const flight of prev) {
					const nextFuel = flight.fuel - 1;
					if (nextFuel <= 0) {
						lostThisTick += 1;
					} else {
						nextFlights.push({ ...flight, fuel: nextFuel });
					}
				}

				if (lostThisTick > 0) {
					setMisses((currentMisses) => {
						const nextMisses = currentMisses + lostThisTick;
						if (nextMisses >= MAX_MISSES) {
							setGameOver(true);
							updateProgress("air-traffic-control", scoreRef.current);
						}
						return nextMisses;
					});
				}

				return nextFlights;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [gameOver, updateProgress]);

	const restart = () => {
		flightIdRef.current = 1;
		setFlights([]);
		setScore(0);
		setLanded(0);
		setMisses(0);
		setGameOver(false);
	};

	const assignRunway = (flightId: number, runway: Runway) => {
		if (gameOver) return;

		let resolved = false;
		let points = 0;
		let wrong = false;

		setFlights((prev) =>
			prev.filter((flight) => {
				if (flight.id !== flightId) return true;
				resolved = true;
				if (flight.runway === runway) {
					points = 18 + flight.fuel * 3 + level * 2;
				} else {
					wrong = true;
				}
				return false;
			}),
		);

		if (!resolved) return;

		if (wrong) {
			haptic.error();
			setMisses((currentMisses) => {
				const nextMisses = currentMisses + 1;
				if (nextMisses >= MAX_MISSES) {
					setGameOver(true);
					updateProgress("air-traffic-control", scoreRef.current);
				}
				return nextMisses;
			});
			return;
		}

		setScore((prev) => prev + points);
		haptic.success();
		setLanded((prev) => prev + 1);
	};

	const pressureLabel =
		level <= 2
			? t("atcLightTraffic")
			: level <= 4
				? t("atcBusyAirspace")
				: t("atcPeakTraffic");

	const missHearts = Array.from({ length: MAX_MISSES }, (_, i) => i < misses ? "💥" : "✈️");

	return (
		<View style={styles.root}>
			{/* Stats row */}
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("atcLanded")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>{landed}</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("atcScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</View>
				<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("atcMisses")}
					</Text>
					<Text style={styles.heartRow}>{missHearts.join(" ")}</Text>
				</View>
			</View>

			{/* Header card */}
			<View
				style={[
					styles.headerCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<View style={styles.headerRow} lightColor="transparent" darkColor="transparent">
					<Text style={[styles.headerEyebrow, { color: theme.mutedText }]}>
						{`${pressureLabel} · L${level}`}
					</Text>
					<View style={styles.runwayLegend} lightColor="transparent" darkColor="transparent">
						{RUNWAYS.map((rwy) => (
							<View
								key={rwy}
								style={styles.legendItem}
								lightColor="transparent"
								darkColor="transparent"
							>
								<View style={[styles.legendDot, { backgroundColor: RUNWAY_COLORS[rwy] }]} />
								<Text style={[styles.legendText, { color: theme.mutedText }]}>{rwy}</Text>
							</View>
						))}
					</View>
				</View>
				<Text style={[styles.headerTitle, { color: theme.text }]}>
					{t("atcAssignHint")}
				</Text>
			</View>

			{/* Flight queue */}
			<FlatList
				data={flights}
				keyExtractor={(item) => String(item.id)}
				contentContainerStyle={styles.queue}
				renderItem={({ item }) => (
					<FlightCard
						item={item}
						onAssign={assignRunway}
						theme={theme}
						t={t as never}
					/>
				)}
				ListEmptyComponent={
					<View style={styles.emptyState}>
						<Text style={[styles.emptyText, { color: theme.mutedText }]}>
							{t("atcQueueEmpty")}
						</Text>
					</View>
				}
			/>

			{gameOver && (
				<GameResult
					title={t("atcGameOver")}
					score={score}
					subtitle={t("atcGameOverSubtitle", { landed, score })}
					onPlayAgain={restart}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 14 },
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
	heartRow: { fontSize: 18, letterSpacing: 2 },
	statDivider: { width: 1, height: 52 },
	headerCard: {
		borderRadius: 16,
		borderWidth: 1,
		padding: 14,
		gap: 6,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	headerEyebrow: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
	},
	runwayLegend: { flexDirection: "row", gap: 10 },
	legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
	legendDot: { width: 8, height: 8, borderRadius: 4 },
	legendText: { fontSize: 11, fontWeight: "700" },
	headerTitle: {
		fontSize: 14,
		fontWeight: "600",
		lineHeight: 20,
	},
	queue: { gap: 10, paddingBottom: 8 },
	flightCard: {
		borderWidth: 1.5,
		borderRadius: 14,
		overflow: "hidden",
		flexDirection: "row",
	},
	runwayAccent: {
		width: 5,
	},
	cardInner: {
		flex: 1,
		padding: 14,
		gap: 10,
	},
	flightTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	callsign: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
	fuelText: { fontSize: 12, fontWeight: "700" },
	fuelTrack: {
		height: 6,
		borderRadius: 3,
		overflow: "hidden",
	},
	fuelBar: {
		height: 6,
		borderRadius: 3,
	},
	targetRow: { flexDirection: "row" },
	targetBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
	},
	targetDot: { width: 7, height: 7, borderRadius: 4 },
	targetRunway: { fontSize: 12, fontWeight: "700" },
	runwayRow: { flexDirection: "row", gap: 8 },
	runwayChip: {
		flex: 1,
		borderWidth: 1.5,
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: "center",
	},
	runwayChipText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
	emptyState: {
		paddingVertical: 32,
		alignItems: "center",
	},
	emptyText: { fontSize: 14, fontWeight: "600" },
});
