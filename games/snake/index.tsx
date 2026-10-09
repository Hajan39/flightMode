import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";

import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useSwipe } from "@/hooks/useSwipe";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  CELL_COUNT,
  type Direction,
  GRID_COLS,
  GRID_ROWS,
  getIntervalMs,
  opposite,
  placeFood,
  step,
} from "./logic";

// ---------------------------------------------------------------------------
// Types (grid/movement logic lives in ./logic, unit-tested)
// ---------------------------------------------------------------------------

type Phase = "idle" | "countdown" | "playing" | "paused" | "over";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SnakeGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useGameDimensions();

  const storedBest = useGameStore((s) => s.progress.snake?.highScore ?? 0);
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
  useEffect(
    () => () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    },
    []
  );

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
  const tickRef = useRef<() => void>(() => {
    // Placeholder until the real tick callback is assigned below.
  });

  // ---------------------------------------------------------------------------
  // Restart interval — always calls the latest tick via tickRef
  // ---------------------------------------------------------------------------
  const restartInterval = useCallback((currentScore: number) => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(
      () => tickRef.current(),
      getIntervalMs(currentScore)
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

    const stepResult = step(currentSnake, dir, currentFood);
    if (stepResult.dead) {
      handleGameOver();
      return;
    }
    const newSnake = stepResult.snake;
    const ateFood = stepResult.ate;

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
    if (phaseRef.current !== "playing") {
      return;
    }
    if (newDir === opposite(directionRef.current)) {
      return;
    }
    directionRef.current = newDir;
  }, []);
  const swipeProps = useSwipe(handleDirectionPress);

  // ---------------------------------------------------------------------------
  // Pause / Resume
  // ---------------------------------------------------------------------------
  const handlePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      phaseRef.current = "paused";
      setPhase("paused");
    }
  }, []);

  const handleResume = useCallback(() => {
    if (phaseRef.current !== "paused") {
      return;
    }
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
      {...swipeProps}
      style={[
        styles.grid,
        {
          borderColor: theme.border,
          height: cellSize * GRID_ROWS,
          width: actualGridSize,
        },
      ]}
    >
      {Array.from({ length: CELL_COUNT }, (_, idx) => {
        const isHead = idx === snake[0];
        const isBody = !isHead && snakeSet.has(idx);
        const isFood = idx === food;

        let cellColor = theme.surface as string;
        if (isHead) {
          cellColor = theme.tint;
        } else if (isBody) {
          cellColor = `${theme.tint}99`;
        } else if (isFood) {
          cellColor = "#ef4444";
        }

        return (
          <RNView
            key={idx}
            style={{
              backgroundColor: cellColor,
              borderRadius: isHead || isBody ? Math.floor(cellSize / 4) : 0,
              height: cellSize,
              width: cellSize,
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
            accessibilityLabel={t("a11yMoveUp")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleDirectionPress("up")}
            style={dpadBtnStyle}
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>▲</Text>
          </Pressable>
        </RNView>
        {/* Left / Right */}
        <RNView style={styles.dpadRow}>
          <Pressable
            accessibilityLabel={t("a11yMoveLeft")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleDirectionPress("left")}
            style={dpadBtnStyle}
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>◀</Text>
          </Pressable>
          <RNView style={styles.dpadCenter} />
          <Pressable
            accessibilityLabel={t("a11yMoveRight")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleDirectionPress("right")}
            style={dpadBtnStyle}
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>▶</Text>
          </Pressable>
        </RNView>
        {/* Down */}
        <RNView style={styles.dpadRow}>
          <Pressable
            accessibilityLabel={t("a11yMoveDown")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleDirectionPress("down")}
            style={dpadBtnStyle}
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
            accessibilityLabel={t("gameReady")}
            accessibilityRole="button"
            onPress={startGame}
            style={[styles.startBtn, { backgroundColor: theme.tint }]}
          >
            <Text style={[styles.startBtnText, { color: theme.onTint }]}>
              {t("gameReady")}
            </Text>
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
          isPaused={phase === "paused"}
          onPause={handlePause}
          onReset={startGame}
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
        onRestart={startGame}
        onResume={handleResume}
        visible={phase === "paused"}
      />

      {/* Result overlay */}
      {phase === "over" && result ? (
        <GameResult
          best={result.best}
          isNewBest={result.isNewBest}
          last={result.last === score ? undefined : result.last}
          onPlayAgain={startGame}
          score={score}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          title={t("snkGameOver")}
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
  description: {
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  // D-pad
  dpad: {
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  dpadArrow: {
    fontSize: FontSize.xl,
  },
  dpadBtn: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    height: DPAD_BTN_SIZE,
    justifyContent: "center",
    width: DPAD_BTN_SIZE,
  },
  dpadCenter: {
    height: DPAD_BTN_SIZE,
    width: DPAD_BTN_SIZE,
  },
  dpadRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.xs,
  },
  // Grid
  grid: {
    alignSelf: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  hud: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    marginRight: Spacing.sm,
  },
  // HUD row
  hudRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  // Idle
  idleContainer: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.lg,
    justifyContent: "center",
    padding: Spacing.xl,
  },
  root: {
    flex: 1,
  },
  startBtn: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl * 2,
    paddingVertical: Spacing.md,
  },
  startBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.md,
    borderWidth: 1,
    flex: 1,
    padding: Spacing.sm,
  },
  statLabel: {
    fontSize: FontSize.xs,
    textAlign: "center",
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  title: {
    fontSize: FontSize["4xl"],
    fontWeight: FontWeight.extrabold,
    textAlign: "center",
  },
});
