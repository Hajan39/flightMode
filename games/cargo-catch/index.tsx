import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Pressable,
	View as RNView,
	StyleSheet,
	useWindowDimensions,
} from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_DURATION_MS = 60_000;
const TOTAL_SECONDS = 60;
const LANES = 5;
const START_LIVES = 3;
const TICK_MS = 55; // game loop tick — smooth-ish fall without heavy work
const BOARD_MAX_WIDTH = 380;
const HAZARD_CHANCE = 0.28;

const GOOD_EMOJI = ["📦", "🧳", "🎒"];
const HAZARD_EMOJI = "💣";

// ---------------------------------------------------------------------------
// Difficulty ramp (0..1 progress through the round)
// ---------------------------------------------------------------------------

/** Fractional distance (0..1) an item falls per tick. Ramps up over time. */
function getFallStep(progress: number): number {
	return 0.028 + progress * 0.03;
}

/** Milliseconds between spawns. Shrinks as the round progresses. */
function getSpawnIntervalMs(progress: number): number {
	return Math.round(760 - progress * 320);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "idle" | "countdown" | "running" | "paused" | "over";

interface FallingItem {
	id: number;
	lane: number;
	/** Vertical progress 0 (top) .. >=1 (reached cart row). */
	y: number;
	kind: "good" | "hazard";
	emoji: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CargoCatchGame() {
	const colorScheme = useColorScheme();
	const theme = Colors[colorScheme];
	const { t } = useTranslation();
	const haptic = useHaptic();
	const { width: screenWidth } = useWindowDimensions();

	const storedBest = useGameStore(
		(s) => s.progress["cargo-catch"]?.highScore ?? 0,
	);
	const updateProgress = useGameStore((s) => s.updateProgress);

	// ---- Render state ----
	const [phase, setPhase] = useState<Phase>("idle");
	const [score, setScore] = useState(0);
	const [lives, setLives] = useState(START_LIVES);
	const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
	const [cartLane, setCartLane] = useState(Math.floor(LANES / 2));
	const [items, setItems] = useState<FallingItem[]>([]);
	const [result, setResult] = useState<GameProgressUpdate | null>(null);

	// ---- Refs (read inside the loop — avoids stale closures) ----
	const phaseRef = useRef<Phase>("idle");
	const scoreRef = useRef(0);
	const livesRef = useRef(START_LIVES);
	const cartLaneRef = useRef(Math.floor(LANES / 2));
	const itemsRef = useRef<FallingItem[]>([]);
	const endTimeRef = useRef<number | null>(null);
	const nextSpawnAtRef = useRef<number>(0);
	const pauseStartRef = useRef<number | null>(null);
	const itemIdRef = useRef(0);
	const gameOverRef = useRef(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// ---- Board layout ----
	const boardWidth = Math.min(screenWidth - Spacing.lg * 2, BOARD_MAX_WIDTH);
	const laneWidth = boardWidth / LANES;
	const itemSize = Math.floor(laneWidth * 0.74);
	const cartHeight = Math.floor(laneWidth * 0.6);
	const boardHeight = Math.round(boardWidth * 1.3);
	// Vertical travel distance for a falling item (top edge) before it hits the cart row.
	const travel = boardHeight - cartHeight - itemSize;

	const clearLoop = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => clearLoop();
	}, [clearLoop]);

	// ---- Single end path (guarded so updateProgress fires exactly once) ----
	const endGame = useCallback(() => {
		if (gameOverRef.current) return;
		gameOverRef.current = true;
		clearLoop();
		haptic.heavy();
		const info = updateProgress("cargo-catch", scoreRef.current, {
			won: true,
		});
		setResult(info);
		itemsRef.current = [];
		setItems([]);
		phaseRef.current = "over";
		setPhase("over");
	}, [clearLoop, haptic, updateProgress]);

	// ---- Spawn one falling item into a random lane ----
	const spawnItem = useCallback(() => {
		const isHazard = Math.random() < HAZARD_CHANCE;
		const lane = Math.floor(Math.random() * LANES);
		const emoji = isHazard
			? HAZARD_EMOJI
			: GOOD_EMOJI[Math.floor(Math.random() * GOOD_EMOJI.length)];
		const item: FallingItem = {
			id: ++itemIdRef.current,
			lane,
			y: 0,
			kind: isHazard ? "hazard" : "good",
			emoji,
		};
		itemsRef.current = [...itemsRef.current, item];
	}, []);

	// ---- Game loop tick (reads refs only) ----
	const tick = useCallback(() => {
		if (phaseRef.current !== "running") return;
		const endTime = endTimeRef.current;
		if (endTime === null) return;

		const now = Date.now();
		const remainingMs = endTime - now;
		const progress = Math.min(1, Math.max(0, 1 - remainingMs / GAME_DURATION_MS));

		// Countdown / time-up
		const nextSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
		setSecondsLeft(nextSeconds);
		if (remainingMs <= 0) {
			endGame();
			return;
		}

		// Spawn on wall-clock schedule
		if (now >= nextSpawnAtRef.current) {
			spawnItem();
			nextSpawnAtRef.current = now + getSpawnIntervalMs(progress);
		}

		// Advance items & resolve those that reached the cart row
		const step = getFallStep(progress);
		const cartLaneNow = cartLaneRef.current;
		const survivors: FallingItem[] = [];
		let caughtGood = 0;
		let hazardHit = false;

		for (const it of itemsRef.current) {
			const ny = it.y + step;
			if (ny >= 1) {
				// Reached the cart row — evaluate horizontal overlap (same lane).
				if (it.lane === cartLaneNow) {
					if (it.kind === "good") caughtGood += 1;
					else hazardHit = true;
				}
				// Missed good cargo is forgiving (no penalty); item just disappears.
			} else {
				survivors.push({ ...it, y: ny });
			}
		}

		itemsRef.current = survivors;
		setItems(survivors);

		if (caughtGood > 0) {
			scoreRef.current += caughtGood;
			setScore(scoreRef.current);
			haptic.tap();
		}

		if (hazardHit) {
			haptic.error();
			livesRef.current = Math.max(0, livesRef.current - 1);
			setLives(livesRef.current);
			if (livesRef.current <= 0) {
				endGame();
				return;
			}
		}
	}, [endGame, haptic, spawnItem]);

	// Stable ref to the latest tick so the interval never goes stale.
	const tickRef = useRef<() => void>(() => {});
	useEffect(() => {
		tickRef.current = tick;
	}, [tick]);

	// ---- Start / control the loop when running ----
	useEffect(() => {
		if (phase !== "running") return;
		clearLoop();
		intervalRef.current = setInterval(() => tickRef.current(), TICK_MS);
		return () => clearLoop();
	}, [phase, clearLoop]);

	// ---- Cart movement ----
	const moveCart = useCallback((dir: -1 | 1) => {
		if (phaseRef.current !== "running") return;
		const next = Math.min(
			LANES - 1,
			Math.max(0, cartLaneRef.current + dir),
		);
		if (next === cartLaneRef.current) return;
		cartLaneRef.current = next;
		setCartLane(next);
	}, []);

	// ---- Lifecycle ----
	const resetState = useCallback(
		(nextPhase: Phase) => {
			clearLoop();
			gameOverRef.current = false;
			scoreRef.current = 0;
			livesRef.current = START_LIVES;
			cartLaneRef.current = Math.floor(LANES / 2);
			itemsRef.current = [];
			itemIdRef.current = 0;
			endTimeRef.current = null;
			nextSpawnAtRef.current = 0;
			pauseStartRef.current = null;
			setScore(0);
			setLives(START_LIVES);
			setCartLane(Math.floor(LANES / 2));
			setItems([]);
			setSecondsLeft(TOTAL_SECONDS);
			setResult(null);
			phaseRef.current = nextPhase;
			setPhase(nextPhase);
		},
		[clearLoop],
	);

	const startGame = useCallback(() => resetState("countdown"), [resetState]);
	const handleReset = useCallback(() => resetState("idle"), [resetState]);

	const onCountdownComplete = useCallback(() => {
		const now = Date.now();
		endTimeRef.current = now + GAME_DURATION_MS;
		nextSpawnAtRef.current = now + 300;
		setSecondsLeft(TOTAL_SECONDS);
		phaseRef.current = "running";
		setPhase("running");
	}, []);

	const handlePause = useCallback(() => {
		if (phaseRef.current !== "running") return;
		clearLoop();
		pauseStartRef.current = Date.now();
		phaseRef.current = "paused";
		setPhase("paused");
	}, [clearLoop]);

	const handleResume = useCallback(() => {
		if (phaseRef.current !== "paused") return;
		const pausedMs =
			pauseStartRef.current !== null ? Date.now() - pauseStartRef.current : 0;
		pauseStartRef.current = null;
		// Shift wall-clock deadlines by the paused duration.
		if (endTimeRef.current !== null) endTimeRef.current += pausedMs;
		nextSpawnAtRef.current += pausedMs;
		phaseRef.current = "running";
		setPhase("running");
	}, []);

	// ---------------------------------------------------------------------------
	// Render helpers
	// ---------------------------------------------------------------------------

	const renderHearts = () => (
		<RNView style={styles.hearts}>
			{Array.from({ length: START_LIVES }, (_, i) => (
				<Ionicons
					key={i}
					name={i < lives ? "heart" : "heart-outline"}
					size={20}
					color={i < lives ? theme.danger : theme.mutedText}
				/>
			))}
		</RNView>
	);

	const renderBoard = () => (
		<RNView
			style={[
				styles.board,
				{
					width: boardWidth,
					height: boardHeight,
					backgroundColor: theme.surface,
					borderColor: theme.border,
				},
			]}
		>
			{/* Lane guides */}
			{Array.from({ length: LANES - 1 }, (_, i) => (
				<RNView
					key={`lane-${i}`}
					style={[
						styles.laneDivider,
						{ left: laneWidth * (i + 1), backgroundColor: theme.border },
					]}
				/>
			))}

			{/* Falling items */}
			{items.map((it) => (
				<RNView
					key={it.id}
					style={{
						position: "absolute",
						width: laneWidth,
						height: itemSize,
						left: it.lane * laneWidth,
						top: Math.min(it.y, 1) * travel,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Text style={{ fontSize: itemSize }}>{it.emoji}</Text>
				</RNView>
			))}

			{/* Loader cart */}
			<RNView
				style={{
					position: "absolute",
					left: cartLane * laneWidth,
					top: boardHeight - cartHeight,
					width: laneWidth,
					height: cartHeight,
					alignItems: "center",
					justifyContent: "flex-end",
				}}
			>
				<RNView
					style={[
						styles.cart,
						{
							width: laneWidth - Spacing.xs,
							height: cartHeight - Spacing.xs,
							backgroundColor: theme.tint,
							borderColor: theme.tint,
						},
					]}
				>
					<Text style={{ fontSize: Math.floor(cartHeight * 0.5) }}>🛒</Text>
				</RNView>
			</RNView>
		</RNView>
	);

	const renderControls = () => {
		const disabled = phase !== "running";
		const btnStyle = [
			styles.moveBtn,
			{
				backgroundColor: theme.card,
				borderColor: theme.border,
				opacity: disabled ? 0.4 : (1 as number),
			},
		];
		return (
			<RNView style={styles.moveRow}>
				<Pressable
					style={btnStyle}
					onPress={() => moveCart(-1)}
					disabled={disabled}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel={t("a11yMoveLeft")}
				>
					<Text style={[styles.moveArrow, { color: theme.text }]}>◀</Text>
				</Pressable>
				<Pressable
					style={btnStyle}
					onPress={() => moveCart(1)}
					disabled={disabled}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel={t("a11yMoveRight")}
				>
					<Text style={[styles.moveArrow, { color: theme.text }]}>▶</Text>
				</Pressable>
			</RNView>
		);
	};

	// ---------------------------------------------------------------------------
	// Idle screen
	// ---------------------------------------------------------------------------

	if (phase === "idle") {
		return (
			<View style={[styles.root, { backgroundColor: theme.background }]}>
				<RNView style={styles.idleContainer}>
					<Text style={styles.idleEmoji}>📦</Text>
					<Text style={[styles.title, { color: theme.text }]}>
						{t("gameCargoCatchName")}
					</Text>
					<Text style={[styles.description, { color: theme.mutedText }]}>
						{t("gameCargoCatchDescription")}
					</Text>
					<Pressable
						style={[styles.startBtn, { backgroundColor: theme.tint }]}
						onPress={startGame}
						accessibilityRole="button"
						accessibilityLabel={t("gameReady")}
					>
						<Text style={[styles.startBtnText, { color: theme.onTint }]}>{t("gameReady")}</Text>
					</Pressable>
				</RNView>
			</View>
		);
	}

	// ---------------------------------------------------------------------------
	// Main game screen
	// ---------------------------------------------------------------------------

	const progress = secondsLeft / TOTAL_SECONDS;
	const isRunning = phase === "running";

	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			{/* Header */}
			<RNView style={styles.headerRow}>
				<RNView style={[styles.bestPill, { backgroundColor: theme.card }]}>
					<Text style={[styles.bestLabel, { color: theme.mutedText }]}>
						{t("gameBest")}
					</Text>
					<Text style={[styles.bestValue, { color: theme.tint }]}>
						{Math.max(storedBest, score)}
					</Text>
				</RNView>
				<GameControls
					onPause={isRunning || phase === "paused" ? handlePause : undefined}
					onReset={handleReset}
					isPaused={phase === "paused"}
				/>
			</RNView>

			{/* Time bar */}
			<RNView style={[styles.timeTrack, { backgroundColor: theme.card }]}>
				<RNView
					style={[
						styles.timeFill,
						{
							backgroundColor: secondsLeft <= 10 ? theme.warning : theme.tint,
							flex: progress,
						},
					]}
				/>
				<RNView style={{ flex: 1 - progress }} />
			</RNView>

			{/* Stats */}
			<RNView style={styles.statsRow}>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("ccScore")}
					</Text>
					<Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
				</RNView>
				<RNView
					style={[styles.statDivider, { backgroundColor: theme.border }]}
				/>
				<RNView style={styles.statBlock}>
					<Text style={[styles.statLabel, { color: theme.mutedText }]}>
						{t("ccTimeLeft")}
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
						{t("ccLives")}
					</Text>
					{renderHearts()}
				</RNView>
			</RNView>

			{/* Board */}
			<RNView style={styles.boardWrap}>{renderBoard()}</RNView>

			{/* Left / right controls */}
			{renderControls()}

			{/* Countdown */}
			{phase === "countdown" && (
				<GameCountdown onComplete={onCountdownComplete} />
			)}

			{/* Pause */}
			<GamePauseOverlay
				visible={phase === "paused"}
				onResume={handleResume}
				onRestart={startGame}
			/>

			{/* Result */}
			{phase === "over" && result ? (
				<GameResult
					title={t("gameCargoCatchName")}
					score={score}
					best={result.best ?? storedBest}
					last={result.last !== score ? result.last : undefined}
					streak={
						result.currentStreak && result.currentStreak > 0
							? result.currentStreak
							: undefined
					}
					isNewBest={result.isNewBest}
					onPlayAgain={startGame}
				/>
			) : null}
		</View>
	);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MOVE_BTN_SIZE = 64;

const styles = StyleSheet.create({
	root: { flex: 1, padding: Spacing.xl, gap: Spacing.lg },
	// Idle
	idleContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.lg,
		padding: Spacing.xl,
	},
	idleEmoji: { fontSize: 64 },
	title: {
		fontSize: FontSize["4xl"],
		fontWeight: FontWeight.extrabold,
		textAlign: "center",
	},
	description: {
		fontSize: FontSize.sm,
		textAlign: "center",
	},
	startBtn: {
		paddingHorizontal: Spacing.xl * 2,
		paddingVertical: Spacing.md,
		borderRadius: Radius.pill,
	},
	startBtnText: {
		fontSize: FontSize.md,
		fontWeight: FontWeight.bold,
	},
	// Header
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	bestPill: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: Radius.pill,
	},
	bestLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	bestValue: { fontSize: FontSize.md, fontWeight: FontWeight.black },
	// Time bar
	timeTrack: {
		height: 6,
		borderRadius: Radius.pill,
		flexDirection: "row",
		overflow: "hidden",
	},
	timeFill: { borderRadius: Radius.pill },
	// Stats
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	statBlock: { flex: 1, alignItems: "center", gap: 4 },
	statLabel: {
		fontSize: FontSize.xs,
		fontWeight: FontWeight.extrabold,
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	statValue: {
		fontSize: FontSize["3xl"],
		fontWeight: FontWeight.black,
		letterSpacing: -1,
	},
	statDivider: { width: 1, height: 40 },
	hearts: { flexDirection: "row", gap: 4, height: FontSize["3xl"], alignItems: "center" },
	// Board
	boardWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
	board: {
		borderWidth: 1,
		borderRadius: Radius.panel,
		overflow: "hidden",
	},
	laneDivider: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: 1,
		opacity: 0.5,
	},
	cart: {
		borderRadius: Radius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	// Move controls
	moveRow: {
		flexDirection: "row",
		justifyContent: "center",
		gap: Spacing.xl,
	},
	moveBtn: {
		width: MOVE_BTN_SIZE,
		height: MOVE_BTN_SIZE,
		borderRadius: Radius.xl,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	moveArrow: {
		fontSize: FontSize["2xl"],
		fontWeight: FontWeight.black,
	},
});
