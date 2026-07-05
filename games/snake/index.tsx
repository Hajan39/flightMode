import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View as RNView,
} from "react-native";

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_COLS = 18;
const GRID_ROWS = 18;
const CELL_COUNT = GRID_COLS * GRID_ROWS;
const BASE_INTERVAL_MS = 300;
const MIN_INTERVAL_MS = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = "up" | "down" | "left" | "right";
type Phase = "idle" | "countdown" | "playing" | "paused" | "over";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIntervalMs(s: number): number {
  return Math.max(MIN_INTERVAL_MS, BASE_INTERVAL_MS - s * 6);
}

function placeFood(snake: number[]): number {
  const snakeSet = new Set(snake);
  const empty: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    if (!snakeSet.has(i)) empty.push(i);
  }
  if (empty.length === 0) return -1; // board full — win condition
  return empty[Math.floor(Math.random() * empty.length)];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SnakeGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const storedBest = useGameStore(
    (s) => s.progress["snake"]?.highScore ?? 0,
  );
  const updateProgress = useGameStore((s) => s.updateProgress);

  // ---------------------------------------------------------------------------
  // React state (for rendering)
  // ---------------------------------------------------------------------------
  const [phase, setPhase] = useState<Phase>("idle");
  const [snake, setSnake] = useState<number[]>([]);
  const [food, setFood] = useState<number>(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // ---------------------------------------------------------------------------
  // Refs (for interval callbacks — avoids stale closures)
  // ---------------------------------------------------------------------------
  const phaseRef = useRef<Phase>("idle");
  const snakeRef = useRef<number[]>([]);
  const foodRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const directionRef = useRef<Direction>("right");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Grid layout
  // ---------------------------------------------------------------------------
  const gridSize = screenWidth - Spacing.lg * 2;
  const cellSize = Math.floor(gridSize / GRID_COLS);
  const actualGridSize = cellSize * GRID_COLS;

  // ---------------------------------------------------------------------------
  // Memoised snake set for O(1) cell lookup
  // ---------------------------------------------------------------------------
  const snakeSet = useMemo(() => new Set(snake), [snake]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  const handleGameOver = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    haptic.error();
    const finalScore = scoreRef.current;
    const info = updateProgress("snake", finalScore);
    setResult(info);
    phaseRef.current = "over";
    setPhase("over");
  }, [haptic, updateProgress]);

  // Stable ref so restartInterval can always call the latest tick without
  // creating a circular dependency in useCallback dependency arrays.
  const tickRef = useRef<() => void>(() => {});

  // ---------------------------------------------------------------------------
  // Restart interval — always calls the latest tick via tickRef
  // ---------------------------------------------------------------------------
  const restartInterval = useCallback((currentScore: number) => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(
      () => tickRef.current(),
      getIntervalMs(currentScore),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Tick (reads refs only — no stale-closure risk)
  // ---------------------------------------------------------------------------
  const tick = useCallback(() => {
    const dir = directionRef.current;
    const currentSnake = snakeRef.current;
    const currentFood = foodRef.current;
    const currentScore = scoreRef.current;

    const head = currentSnake[0];
    const headRow = Math.floor(head / GRID_COLS);
    const headCol = head % GRID_COLS;

    let newRow = headRow;
    let newCol = headCol;
    if (dir === "up") newRow--;
    else if (dir === "down") newRow++;
    else if (dir === "left") newCol--;
    else newCol++;

    // Wall collision
    if (
      newRow < 0 ||
      newRow >= GRID_ROWS ||
      newCol < 0 ||
      newCol >= GRID_COLS
    ) {
      handleGameOver();
      return;
    }

    const newHead = newRow * GRID_COLS + newCol;

    // Self collision (exclude last tail segment — it moves away this tick)
    if (currentSnake.slice(0, -1).includes(newHead)) {
      handleGameOver();
      return;
    }

    const ateFood = newHead === currentFood;
    const newSnake = ateFood
      ? [newHead, ...currentSnake] // grow
      : [newHead, ...currentSnake.slice(0, -1)]; // move

    snakeRef.current = newSnake;
    setSnake(newSnake);

    if (ateFood) {
      const newScore = currentScore + 1;
      scoreRef.current = newScore;
      setScore(newScore);
      haptic.tap();

      const newFood = placeFood(newSnake);
      foodRef.current = newFood;
      setFood(newFood);

      // Speed up
      restartInterval(newScore);
    }
  }, [haptic, handleGameOver, restartInterval]);

  // Keep tickRef up to date with the latest stable tick callback
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // ---------------------------------------------------------------------------
  // Start game
  // ---------------------------------------------------------------------------
  const startGame = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const midRow = Math.floor(GRID_ROWS / 2);
    const midCol = Math.floor(GRID_COLS / 2);
    const initialSnake = [
      midRow * GRID_COLS + midCol,
      midRow * GRID_COLS + midCol - 1,
      midRow * GRID_COLS + midCol - 2,
    ];

    snakeRef.current = initialSnake;
    scoreRef.current = 0;
    directionRef.current = "right";

    const initialFood = placeFood(initialSnake);
    foodRef.current = initialFood;

    setSnake(initialSnake);
    setFood(initialFood);
    setScore(0);
    setResult(null);
    phaseRef.current = "countdown";
    setPhase("countdown");
  }, []);

  const onCountdownComplete = useCallback(() => {
    phaseRef.current = "playing";
    setPhase("playing");
    restartInterval(0);
  }, [restartInterval]);

  // ---------------------------------------------------------------------------
  // Direction handling — prevent 180° reversal
  // ---------------------------------------------------------------------------
  const handleDirectionPress = useCallback((newDir: Direction) => {
    if (phaseRef.current !== "playing") return;
    const opposite: Record<Direction, Direction> = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    if (newDir === opposite[directionRef.current]) return;
    directionRef.current = newDir;
  }, []);

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------
  const handlePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      phaseRef.current = "paused";
      setPhase("paused");
    }
  }, []);

  const handleResume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    phaseRef.current = "playing";
    setPhase("playing");
    restartInterval(scoreRef.current);
  }, [restartInterval]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderHud = () => (
    <RNView style={styles.hud}>
      <RNView
        style={[
          styles.statBox,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.statLabel, { color: theme.mutedText }]}>
          {t("snkScore")}
        </Text>
        <Text style={[styles.statValue, { color: theme.text }]}>{score}</Text>
      </RNView>
      <RNView
        style={[
          styles.statBox,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.statLabel, { color: theme.mutedText }]}>
          {t("snkHighScore")}
        </Text>
        <Text style={[styles.statValue, { color: theme.text }]}>
          {Math.max(storedBest, score)}
        </Text>
      </RNView>
      <RNView
        style={[
          styles.statBox,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.statLabel, { color: theme.mutedText }]}>
          {t("snkLength")}
        </Text>
        <Text style={[styles.statValue, { color: theme.text }]}>
          {snake.length}
        </Text>
      </RNView>
    </RNView>
  );

  const renderGrid = () => (
    <RNView
      style={[
        styles.grid,
        {
          width: actualGridSize,
          height: cellSize * GRID_ROWS,
          borderColor: theme.border,
        },
      ]}
    >
      {Array.from({ length: CELL_COUNT }, (_, idx) => {
        const isHead = idx === snake[0];
        const isBody = !isHead && snakeSet.has(idx);
        const isFood = idx === food;

        return (
          <RNView
            key={idx}
            style={{
              width: cellSize,
              height: cellSize,
              backgroundColor: isHead
                ? theme.tint
                : isBody
                  ? (theme.tint + "99" as string)
                  : isFood
                    ? "#ef4444"
                    : theme.surface,
              borderRadius:
                isHead || isBody ? Math.floor(cellSize / 4) : 0,
            }}
          />
        );
      })}
    </RNView>
  );

  const renderDPad = () => {
    const disabled = phase !== "playing";
    const dpadBtnStyle = [
      styles.dpadBtn,
      {
        backgroundColor: theme.card,
        borderColor: theme.border,
        opacity: disabled ? 0.4 : (1 as number),
      },
    ];

    return (
      <RNView style={styles.dpad}>
        {/* Up */}
        <RNView style={styles.dpadRow}>
          <Pressable
            style={dpadBtnStyle}
            onPress={() => handleDirectionPress("up")}
            disabled={disabled}
            accessibilityLabel="Move up"
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>▲</Text>
          </Pressable>
        </RNView>
        {/* Left / Right */}
        <RNView style={styles.dpadRow}>
          <Pressable
            style={dpadBtnStyle}
            onPress={() => handleDirectionPress("left")}
            disabled={disabled}
            accessibilityLabel="Move left"
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>◀</Text>
          </Pressable>
          <RNView style={styles.dpadCenter} />
          <Pressable
            style={dpadBtnStyle}
            onPress={() => handleDirectionPress("right")}
            disabled={disabled}
            accessibilityLabel="Move right"
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>▶</Text>
          </Pressable>
        </RNView>
        {/* Down */}
        <RNView style={styles.dpadRow}>
          <Pressable
            style={dpadBtnStyle}
            onPress={() => handleDirectionPress("down")}
            disabled={disabled}
            accessibilityLabel="Move down"
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>▼</Text>
          </Pressable>
        </RNView>
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
          <Text style={[styles.title, { color: theme.text }]}>
            {t("gameSnakeName")}
          </Text>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            {t("snkEatHint")}
          </Text>
          <Pressable
            style={[styles.startBtn, { backgroundColor: theme.tint }]}
            onPress={startGame}
          >
            <Text style={styles.startBtnText}>{t("gameReady")}</Text>
          </Pressable>
        </RNView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main game screen
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* HUD + controls row */}
      <RNView style={styles.hudRow}>
        {renderHud()}
        <GameControls
          onPause={handlePause}
          onReset={startGame}
          isPaused={phase === "paused"}
        />
      </RNView>

      {/* Grid */}
      {renderGrid()}

      {/* D-pad */}
      {renderDPad()}

      {/* Countdown overlay */}
      {phase === "countdown" && (
        <GameCountdown onComplete={onCountdownComplete} />
      )}

      {/* Pause overlay */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={startGame}
      />

      {/* Result overlay */}
      {phase === "over" && result ? (
        <GameResult
          title={t("snkGameOver")}
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

const DPAD_BTN_SIZE = 52;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Idle
  idleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
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
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  // HUD row
  hudRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  hud: {
    flexDirection: "row",
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statBox: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: "center",
  },
  statLabel: {
    fontSize: FontSize.xs,
    textAlign: "center",
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  // Grid
  grid: {
    alignSelf: "center",
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
    borderRadius: Radius.sm,
  },
  // D-pad
  dpad: {
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  dpadRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
  },
  dpadCenter: {
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
  },
  dpadBtn: {
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dpadArrow: {
    fontSize: FontSize.xl,
  },
});
