import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Pressable,
	View as RNView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";

const GAME_DURATION_MS = 30_000;
const GRID_SIZE = 9;

// Mole display duration: starts at 1400ms, linearly drops to 700ms at end
function getMoleDurationMs(elapsedMs: number): number {
	const progress = Math.min(1, elapsedMs / GAME_DURATION_MS);
	return Math.round(1400 - progress * 700);
}

// How many moles to show at once based on time remaining
function getMoleCount(remainingMs: number): number {
	if (remainingMs <= 8_000) return 3;
	if (remainingMs <= 15_000) return 2;
	return 1;
}

type Phase = "idle" | "countdown" | "running" | "paused" | "over";

interface MoleState {
	cellIndex: number;
	expiresAt: number; // wall-clock ms when mole disappears
	id: number; // unique id to distinguish moles
}

export default function WhackMoleGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const updateProgress = useGameStore((s) => s.updateProgress);
	const storedBest = useGameStore(
		(s) => s.progress["whack-mole"]?.highScore ?? 0,
	);
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width: screenWidth } = useWindowDimensions();
	// 3 columns, 10px gap, 20px screen padding either side — fixed size so
	// cells don't collapse/jump when a mole's text content mounts.
	const cellSize = Math.floor((screenWidth - 40 - 20) / 3);

	const [phase, setPhase] = useState<Phase>("idle");
	const [secondsLeft, setSecondsLeft] = useState(30);
	const [score, setScore] = useState(0);
	const [activeMoles, setActiveMoles] = useState<MoleState[]>([]);
	const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
		null,
	);

	const scoreRef = useRef(0);
	const endTimeRef = useRef<number | null>(null);
	const moleIdRef = useRef(0);
	const activeMolesRef = useRef<MoleState[]>([]);
	const phaseRef = useRef<Phase>("idle");
	const pauseStartRef = useRef<number | null>(null);
	const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const moleSpawnTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	// Keep refs in sync
	activeMolesRef.current = activeMoles;
	phaseRef.current = phase;

	const clearAllMoleTimers = useCallback(() => {
		moleSpawnTimersRef.current.forEach((timer) => clearTimeout(timer));
		moleSpawnTimersRef.current.clear();
	}, []);

	// Pick a random available cell (not occupied by any active mole)
	const pickFreeCell = useCallback((occupied: number[]): number | null => {
		const available: number[] = [];
		for (let i = 0; i < GRID_SIZE; i++) {
			if (!occupied.includes(i)) available.push(i);
		}
		if (available.length === 0) return null;
		return available[Math.floor(Math.random() * available.length)];
	}, []);

	const spawnMole = useCallback(
		(delayMs = 0) => {
			const timerId = setTimeout(() => {
				if (phaseRef.current !== "running") return;

				const endTime = endTimeRef.current;
				if (!endTime) return;
				const now = Date.now();
				const remainingMs = endTime - now;
				const elapsedMs = GAME_DURATION_MS - remainingMs;

				if (remainingMs <= 0) return;

				const currentMoles = activeMolesRef.current;
				const targetCount = getMoleCount(remainingMs);

				// Don't spawn if already at or above target count
				if (currentMoles.length >= targetCount) return;

				const occupied = currentMoles.map((m) => m.cellIndex);
				const cellIndex = pickFreeCell(occupied);
				if (cellIndex === null) return;

				const moleDuration = getMoleDurationMs(elapsedMs);
				const moleId = ++moleIdRef.current;
				const expiresAt = now + moleDuration;

				const newMole: MoleState = { cellIndex, expiresAt, id: moleId };

				setActiveMoles((prev) => [...prev, newMole]);

				// Schedule mole expiry
				const expireTimerId = setTimeout(() => {
					if (phaseRef.current !== "running") return;
					setActiveMoles((prev) => prev.filter((m) => m.id !== moleId));
					// Spawn a replacement after a short gap
					spawnMole(150);
				}, moleDuration);

				moleSpawnTimersRef.current.set(moleId, expireTimerId);
			}, delayMs);

			// Track main spawn delay timer too (use negative id to distinguish)
			const trackId = -(++moleIdRef.current);
			moleSpawnTimersRef.current.set(trackId, timerId);
		},
		[pickFreeCell],
	);

	// Main game tick: update countdown and check for game-over
	useEffect(() => {
		if (phase !== "running") return;

		const tick = () => {
			const endTime = endTimeRef.current;
			if (!endTime) return;

			const remainingMs = endTime - Date.now();
			const nextSecondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
			setSecondsLeft(nextSecondsLeft);

			if (remainingMs <= 0) {
				haptic.heavy();
				const info = updateProgress("whack-mole", scoreRef.current);
				setProgressInfo(info);
				setActiveMoles([]);
				setPhase("over");
			}
		};

		tick();
		const interval = setInterval(tick, 100);
		tickIntervalRef.current = interval;

		return () => {
			clearInterval(interval);
			tickIntervalRef.current = null;
		};
	}, [phase, updateProgress, haptic]);

	// Spawn initial mole(s) when game starts; also manage mole count as time decreases
	useEffect(() => {
		if (phase !== "running") return;

		// Spawn initial mole immediately
		spawnMole(0);

		// Periodically check if we need more moles (for the count-increase thresholds)
		const checkInterval = setInterval(() => {
			if (phaseRef.current !== "running") return;
			const endTime = endTimeRef.current;
			if (!endTime) return;
			const remainingMs = endTime - Date.now();
			const targetCount = getMoleCount(remainingMs);
			const currentCount = activeMolesRef.current.length;
			if (currentCount < targetCount) {
				spawnMole(0);
			}
		}, 500);

		return () => clearInterval(checkInterval);
	}, [phase, spawnMole]);

	const handleMoleTap = useCallback(
		(moleId: number) => {
			if (phaseRef.current !== "running") return;

			// Remove the expiry timer for this mole
			const timer = moleSpawnTimersRef.current.get(moleId);
			if (timer) {
				clearTimeout(timer);
				moleSpawnTimersRef.current.delete(moleId);
			}

			haptic.success();
			scoreRef.current += 1;
			setScore(scoreRef.current);
			setActiveMoles((prev) => prev.filter((m) => m.id !== moleId));

			// Spawn replacement after brief gap
			spawnMole(200);
		},
		[haptic, spawnMole],
	);

	const startGame = () => {
		scoreRef.current = 0;
		moleIdRef.current = 0;
		endTimeRef.current = null;
		setScore(0);
		setSecondsLeft(30);
		setActiveMoles([]);
		setProgressInfo(null);
		setPhase("countdown");
	};

	const handleReset = () => {
		clearAllMoleTimers();
		if (tickIntervalRef.current) {
			clearInterval(tickIntervalRef.current);
			tickIntervalRef.current = null;
		}
		scoreRef.current = 0;
		moleIdRef.current = 0;
		endTimeRef.current = null;
		setScore(0);
		setSecondsLeft(30);
		setActiveMoles([]);
		setProgressInfo(null);
		setPhase("idle");
	};

	const handlePause = () => {
		if (phase !== "running") return;
		pauseStartRef.current = Date.now();
		clearAllMoleTimers();
		setPhase("paused");
	};

	const handleResume = () => {
		if (phase !== "paused") return;
		const pausedMs =
			pauseStartRef.current !== null ? Date.now() - pauseStartRef.current : 0;
		pauseStartRef.current = null;
		if (endTimeRef.current !== null) endTimeRef.current += pausedMs;
		// Shift mole deadlines by the pause duration and reschedule their expiry
		const now = Date.now();
		const shiftedMoles = activeMolesRef.current.map((m) => ({
			...m,
			expiresAt: m.expiresAt + pausedMs,
		}));
		shiftedMoles.forEach((mole) => {
			const expireTimerId = setTimeout(() => {
				if (phaseRef.current !== "running") return;
				setActiveMoles((prev) => prev.filter((m) => m.id !== mole.id));
				// Spawn a replacement after a short gap
				spawnMole(150);
			}, Math.max(0, mole.expiresAt - now));
			moleSpawnTimersRef.current.set(mole.id, expireTimerId);
		});
		setActiveMoles(shiftedMoles);
		setPhase("running");
	};

	// Clean up on unmount
	useEffect(() => {
		return () => {
			clearAllMoleTimers();
			if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
		};
	}, [clearAllMoleTimers]);

	const progress = secondsLeft / 30;
	const isRunning = phase === "running";
	const activeMoleSet = new Set(activeMoles.map((m) => m.cellIndex));
	const moleByCell = new Map(activeMoles.map((m) => [m.cellIndex, m]));

	return (
		<View style={styles.root}>
			{/* Header row */}
			<RNView style={styles.headerRow}>
				<RNView style={[styles.bestPill, { backgroundColor: theme.card }]}>
					<Text style={[styles.bestLabel, { color: theme.mutedText }]}>
						{t("gameBest")}
					</Text>
					<Text style={[styles.bestValue, { color: theme.tint }]}>
						{storedBest}
					</Text>
				</RNView>
				<GameControls
					onPause={isRunning || phase === "paused" ? handlePause : undefined}
					onReset={phase !== "idle" ? handleReset : undefined}
					isPaused={phase === "paused"}
				/>
			</RNView>

			{/* Time bar */}
			<RNView style={[styles.timeTrack, { backgroundColor: theme.card }]}>
				<RNView
					style={[
						styles.timeFill,
						{
							backgroundColor: secondsLeft <= 5 ? theme.danger : theme.tint,
							flex: progress,
						},
					]}
				/>
			</RNView>

			{/* Stats */}
			<RNView style={styles.statsRow}>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("whackTime")}
					</Text>
					<Text style={[styles.statValue, { color: theme.text }]}>
						{secondsLeft}s
					</Text>
				</RNView>
				<RNView
					style={[styles.statDivider, { backgroundColor: theme.border }]}
				/>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("whackScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</RNView>
			</RNView>

			{/* Grid */}
			{phase === "idle" ? (
				<Pressable
					style={[
						styles.idleArea,
						{ backgroundColor: theme.elevated, borderColor: theme.border },
					]}
					onPress={startGame}
					accessibilityRole="button"
					accessibilityLabel={t("gameTapToStart")}
				>
					<Text style={[styles.idleEmoji]}>🐹</Text>
					<Text style={[styles.idleLabel, { color: theme.mutedText }]}>
						{t("gameTapToStart")}
					</Text>
				</Pressable>
			) : (
				<RNView style={styles.grid}>
					{Array.from({ length: GRID_SIZE }, (_, i) => {
						const isActive = activeMoleSet.has(i);
						const mole = moleByCell.get(i);
						return (
							<Pressable
								key={i}
								style={[
									styles.cell,
									{
										width: cellSize,
										height: cellSize,
										backgroundColor: isActive ? theme.tint : theme.card,
										borderColor: isActive ? theme.tint : theme.border,
									},
								]}
								onPress={
									isActive && mole
										? () => handleMoleTap(mole.id)
										: undefined
								}
								disabled={!isActive || phase !== "running"}
							>
								{isActive ? (
									<Text style={styles.moleEmoji}>🐹</Text>
								) : null}
							</Pressable>
						);
					})}
				</RNView>
			)}

			{phase === "countdown" && (
				<GameCountdown
					onComplete={() => {
						endTimeRef.current = Date.now() + GAME_DURATION_MS;
						setSecondsLeft(30);
						setPhase("running");
					}}
				/>
			)}

			<GamePauseOverlay
				visible={phase === "paused"}
				onResume={handleResume}
				onRestart={() => {
					handleReset();
					startGame();
				}}
			/>

			{phase === "over" && (
				<GameResult
					title={t("gameWhackMoleName")}
					score={score}
					best={progressInfo?.best ?? storedBest}
					last={progressInfo?.previousBest}
					streak={progressInfo?.currentStreak}
					isNewBest={progressInfo?.isNewBest}
					onPlayAgain={startGame}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 20, gap: 16 },
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	bestPill: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
	},
	bestLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	bestValue: { fontSize: 16, fontWeight: "900" },
	timeTrack: {
		height: 6,
		borderRadius: 999,
		flexDirection: "row",
		overflow: "hidden",
	},
	timeFill: { borderRadius: 999 },
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", gap: 4 },
	statLabel: {
		fontSize: 11,
		fontWeight: "800",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
	statDivider: { width: 1, height: 50 },
	// Idle screen
	idleArea: {
		flex: 1,
		borderRadius: 24,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},
	idleEmoji: { fontSize: 64 },
	idleLabel: {
		fontSize: 20,
		fontWeight: "900",
		letterSpacing: 2,
		textTransform: "uppercase",
	},
	// Grid
	grid: {
		flex: 1,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		justifyContent: "center",
		alignContent: "center",
	},
	cell: {
		borderRadius: 20,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	moleEmoji: { fontSize: 42 },
});
