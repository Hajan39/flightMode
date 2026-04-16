import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet } from "react-native";

import { Text, View } from "@/components/Themed";
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
};

const RUNWAYS: Runway[] = ["A", "B", "C"];
const MAX_MISSES = 3;
const MAX_LEVEL = 6;

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
				if (prev.length >= maxQueueSize) {
					return prev;
				}

				const id = flightIdRef.current++;
				return [
					...prev,
					{
						id,
						callsign: createCallsign(id),
						runway: randomRunway(),
						fuel: getStartingFuel(level, id),
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

	return (
		<View style={styles.root}>
			<View style={styles.statsRow}>
				<View style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("atcLanded")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{landed}
					</Text>
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
					<Text style={[styles.statValue, { color: theme.warning }]}>
						{misses}/{MAX_MISSES}
					</Text>
				</View>
			</View>

			<View
				style={[
					styles.headerCard,
					{ backgroundColor: theme.card, borderColor: theme.border },
				]}
			>
				<Text style={[styles.headerEyebrow, { color: theme.mutedText }]}>
					{`${pressureLabel} • L${level}`}
				</Text>
				<Text style={styles.headerTitle}>{t("atcAssignHint")}</Text>
			</View>

			<FlatList
				data={flights}
				keyExtractor={(item) => String(item.id)}
				contentContainerStyle={styles.queue}
				renderItem={({ item }) => (
					<View
						style={[
							styles.flightCard,
							{ backgroundColor: theme.elevated, borderColor: theme.border },
						]}
					>
						<View
							style={styles.flightTop}
							lightColor="transparent"
							darkColor="transparent"
						>
							<Text style={styles.callsign}>{item.callsign}</Text>
							<Text
								style={[
									styles.fuelText,
									{ color: item.fuel <= 3 ? theme.warning : theme.mutedText },
								]}
							>
								{t("atcFuel", { fuel: item.fuel })}
							</Text>
						</View>
						<Text style={[styles.targetRunway, { color: theme.text }]}>
							{t("atcTargetRunway", { rwy: item.runway })}
						</Text>
						<View
							style={styles.runwayRow}
							lightColor="transparent"
							darkColor="transparent"
						>
							{RUNWAYS.map((runway) => (
								<Pressable
									key={runway}
									style={[
										styles.runwayChip,
										{ backgroundColor: theme.card, borderColor: theme.border },
									]}
									onPress={() => assignRunway(item.id, runway)}
								>
									<Text style={[styles.runwayChipText, { color: theme.tint }]}>
										{t("atcRwy", { rwy: runway })}
									</Text>
								</Pressable>
							))}
						</View>
					</View>
				)}
				ListEmptyComponent={
					<View style={styles.emptyState}>
						<Text style={[styles.emptyText, { color: theme.mutedText }]}>
							{t("atcQueueEmpty")}
						</Text>
					</View>
				}
			/>

			{gameOver ? (
				<Pressable
					style={[styles.restartButton, { backgroundColor: theme.tint }]}
					onPress={restart}
				>
					<Text style={styles.restartText}>{t("atcRestartControl")}</Text>
				</Pressable>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16 },
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
	statDivider: { width: 1, height: 52 },
	headerCard: {
		borderRadius: 16,
		borderWidth: 1,
		padding: 16,
		gap: 6,
	},
	headerEyebrow: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
	},
	headerTitle: {
		fontSize: 16,
		fontWeight: "700",
		lineHeight: 22,
	},
	queue: { gap: 10, paddingBottom: 8 },
	flightCard: {
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
		gap: 10,
	},
	flightTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	callsign: { fontSize: 16, fontWeight: "800" },
	fuelText: { fontSize: 13, fontWeight: "700" },
	targetRunway: { fontSize: 14, fontWeight: "600" },
	runwayRow: { flexDirection: "row", gap: 8 },
	runwayChip: {
		flex: 1,
		borderWidth: 1,
		borderRadius: 10,
		paddingVertical: 10,
		alignItems: "center",
	},
	runwayChipText: { fontSize: 13, fontWeight: "800" },
	emptyState: {
		paddingVertical: 24,
		alignItems: "center",
	},
	emptyText: { fontSize: 14, fontWeight: "600" },
	restartButton: {
		alignItems: "center",
		paddingVertical: 16,
		borderRadius: 14,
	},
	restartText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "900",
		letterSpacing: 0.8,
	},
});
