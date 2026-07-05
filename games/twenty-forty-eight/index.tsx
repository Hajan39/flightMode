import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View as RNView, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_SIZE = 4;
const GAP = 8;
const PADDING = 12;

// Tile colors: [background, text]
const TILE_COLORS: Record<number, [string, string]> = {
  0: ["transparent", "#776e65"],
  2: ["#eee4da", "#776e65"],
  4: ["#ede0c8", "#776e65"],
  8: ["#f2b179", "#ffffff"],
  16: ["#f59563", "#ffffff"],
  32: ["#f67c5f", "#ffffff"],
  64: ["#f65e3b", "#ffffff"],
  128: ["#edcf72", "#ffffff"],
  256: ["#edcc61", "#ffffff"],
  512: ["#edc850", "#ffffff"],
  1024: ["#edc53f", "#ffffff"],
  2048: ["#edc22e", "#ffffff"],
};

const HIGH_TILE_COLORS: [string, string] = ["#3c3a32", "#ffffff"];

function getTileColors(value: number): [string, string] {
  if (value === 0) return TILE_COLORS[0];
  return TILE_COLORS[value] ?? HIGH_TILE_COLORS;
}

function getTileFontSize(value: number): number {
  if (value < 100) return FontSize.xl;
  if (value < 1000) return FontSize.lg;
  if (value < 10000) return FontSize.md;
  return FontSize.sm;
}

// ---------------------------------------------------------------------------
// Grid logic
// ---------------------------------------------------------------------------

type Grid = number[][];

function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function getEmptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function addRandomTile(grid: Grid): Grid {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const next = grid.map((row) => [...row]);
  next[r][c] = value;
  return next;
}

function createInitialGrid(): Grid {
  let grid = createEmptyGrid();
  grid = addRandomTile(grid);
  grid = addRandomTile(grid);
  return grid;
}

/**
 * Slide a single row/line toward the left (index 0).
 * Returns { line, score, moved }.
 */
function slideLine(line: number[]): { line: number[]; score: number; moved: boolean } {
  const filtered = line.filter((v) => v !== 0);
  let score = 0;
  let moved = false;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  // Pad with zeros
  while (merged.length < GRID_SIZE) merged.push(0);
  // Check if anything changed
  for (let j = 0; j < GRID_SIZE; j++) {
    if (merged[j] !== line[j]) {
      moved = true;
      break;
    }
  }
  return { line: merged, score, moved };
}

type Direction = "left" | "right" | "up" | "down";

function applyMove(
  grid: Grid,
  direction: Direction,
): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const next = createEmptyGrid();

  if (direction === "left") {
    for (let r = 0; r < GRID_SIZE; r++) {
      const { line, score, moved } = slideLine(grid[r]);
      next[r] = line;
      totalScore += score;
      if (moved) anyMoved = true;
    }
  } else if (direction === "right") {
    for (let r = 0; r < GRID_SIZE; r++) {
      const reversed = [...grid[r]].reverse();
      const { line, score, moved } = slideLine(reversed);
      next[r] = line.reverse();
      totalScore += score;
      if (moved) anyMoved = true;
    }
  } else if (direction === "up") {
    for (let c = 0; c < GRID_SIZE; c++) {
      const col = grid.map((row) => row[c]);
      const { line, score, moved } = slideLine(col);
      for (let r = 0; r < GRID_SIZE; r++) next[r][c] = line[r];
      totalScore += score;
      if (moved) anyMoved = true;
    }
  } else {
    // down
    for (let c = 0; c < GRID_SIZE; c++) {
      const col = grid.map((row) => row[c]).reverse();
      const { line, score, moved } = slideLine(col);
      const reversed = line.reverse();
      for (let r = 0; r < GRID_SIZE; r++) next[r][c] = reversed[r];
      totalScore += score;
      if (moved) anyMoved = true;
    }
  }

  return { grid: next, score: totalScore, moved: anyMoved };
}

function hasWon(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] >= 2048) return true;
    }
  }
  return false;
}

function isGameOver(grid: Grid): boolean {
  // Any empty cell?
  if (getEmptyCells(grid).length > 0) return false;
  // Any adjacent equal tiles?
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) return false;
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tile (animated cell)
// ---------------------------------------------------------------------------

function Tile({
  value,
  cellSize,
  borderColor,
}: {
  value: number;
  cellSize: number;
  borderColor: string;
}) {
  const scale = useSharedValue(1);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (value === 0 || value === prev) return;
    if (prev === 0) {
      // Tile appeared in this cell (new tile or slid in): quick pop-in
      scale.value = 0.6;
      scale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    } else if (value > prev) {
      // Cell value grew: merge pulse
      scale.value = withSequence(
        withTiming(1.15, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 110, easing: Easing.in(Easing.quad) }),
      );
    }
  }, [value, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const [bgColor, textColor] = getTileColors(value);
  const isTransparent = value === 0;

  return (
    <Animated.View
      style={[
        styles.cell,
        {
          width: cellSize,
          height: cellSize,
          borderRadius: Radius.sm,
          backgroundColor: isTransparent ? "transparent" : bgColor,
          borderWidth: isTransparent ? 1 : 0,
          borderColor,
        },
        animStyle,
      ]}
    >
      {value !== 0 ? (
        <Text
          style={[
            styles.cellText,
            {
              color: textColor,
              fontSize: getTileFontSize(value),
            },
          ]}
        >
          {value}
        </Text>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "idle" | "playing" | "over";

export default function TwentyFortyEightGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const storedBest = useGameStore((s) => s.progress["twenty-forty-eight"]?.highScore ?? 0);
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("idle");
  const [paused, setPaused] = useState(false);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [score, setScore] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  // Track whether we've already triggered a win to avoid double-recording
  const winFiredRef = useRef(false);
  // Track whether the game has already ended to avoid double updateProgress
  const gameOverRef = useRef(false);

  // Derived cell size based on screen width
  const gridWidth = screenWidth - Spacing.lg * 2;
  const cellSize = (gridWidth - GAP * (GRID_SIZE - 1) - PADDING * 2) / GRID_SIZE;

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  const startGame = useCallback(() => {
    setGrid(createInitialGrid());
    setScore(0);
    setMoveCount(0);
    setResult(null);
    setWinMessage(null);
    setPaused(false);
    winFiredRef.current = false;
    gameOverRef.current = false;
    setPhase("playing");
  }, []);

  const endGame = useCallback(
    (finalScore: number, won: boolean) => {
      if (gameOverRef.current) return;
      gameOverRef.current = true;
      const update = updateProgress("twenty-forty-eight", finalScore, { won });
      setResult(update);
      setPhase("over");
    },
    [updateProgress],
  );

  // ---------------------------------------------------------------------------
  // Move handling
  // ---------------------------------------------------------------------------

  const handleMove = useCallback(
    (direction: Direction) => {
      if (phase !== "playing" || paused) return;

      setGrid((currentGrid) => {
        const { grid: nextGrid, score: gained, moved } = applyMove(currentGrid, direction);

        if (!moved) return currentGrid;

        haptic.tap();

        // Add a new random tile
        const withNew = addRandomTile(nextGrid);

        // Update score and move count via state updaters
        setScore((prev) => {
          const newScore = prev + gained;

          // Check win (2048 reached for the first time)
          if (!winFiredRef.current && hasWon(withNew)) {
            winFiredRef.current = true;
            setWinMessage(t("tfeYouWin"));
            haptic.success();
            // Schedule end-of-game update after render
            setTimeout(() => {
              endGame(newScore, true);
            }, 0);
          } else if (isGameOver(withNew)) {
            haptic.error();
            setTimeout(() => {
              endGame(newScore, false);
            }, 0);
          }

          return newScore;
        });

        setMoveCount((prev) => prev + 1);

        return withNew;
      });
    },
    [phase, paused, haptic, t, endGame],
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderGrid = () => {
    return (
      <RNView
        style={[
          styles.grid,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            width: gridWidth,
            padding: PADDING,
            gap: GAP,
          },
        ]}
      >
        {grid.map((row, rIdx) => (
          <RNView key={rIdx} style={[styles.gridRow, { gap: GAP }]}>
            {row.map((value, cIdx) => (
              <Tile
                key={cIdx}
                value={value}
                cellSize={cellSize}
                borderColor={theme.border}
              />
            ))}
          </RNView>
        ))}
      </RNView>
    );
  };

  const renderDPad = () => {
    const disabled = phase !== "playing" || paused;
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
            onPress={() => handleMove("up")}
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
            onPress={() => handleMove("left")}
            disabled={disabled}
            accessibilityLabel="Move left"
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>◀</Text>
          </Pressable>
          <RNView style={styles.dpadCenter} />
          <Pressable
            style={dpadBtnStyle}
            onPress={() => handleMove("right")}
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
            onPress={() => handleMove("down")}
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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Pressable
          style={[styles.startBtn, { backgroundColor: theme.tint }]}
          onPress={startGame}
        >
          <Text style={styles.startBtnText}>{t("gameTapToStart")}</Text>
        </Pressable>
        <Text style={[styles.hint, { color: theme.mutedText }]}>
          {t("tfeSwipeHint")}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main game screen
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top bar: stats + controls */}
      <RNView style={styles.topBar}>
        <RNView style={styles.statsRow}>
          <RNView style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("tfeScore")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{score}</Text>
          </RNView>
          <RNView style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("tfeBestTile")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {Math.max(storedBest, score)}
            </Text>
          </RNView>
          <RNView style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("tfeMoves")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{moveCount}</Text>
          </RNView>
        </RNView>
        <GameControls
          onPause={() => setPaused((p) => !p)}
          onReset={startGame}
          isPaused={paused}
        />
      </RNView>

      {/* Hint */}
      <Text style={[styles.hint, { color: theme.mutedText }]}>
        {t("tfeSwipeHint")}
      </Text>

      {/* Grid */}
      {renderGrid()}

      {/* D-pad */}
      {renderDPad()}

      {/* Pause overlay */}
      <GamePauseOverlay
        visible={paused}
        onResume={() => setPaused(false)}
        onRestart={startGame}
      />

      {/* Result overlay */}
      {phase === "over" && result ? (
        <GameResult
          title={winMessage ? t("tfeYouWin") : t("tfeGameOver")}
          subtitle={winMessage ? undefined : undefined}
          score={score}
          best={result.best}
          last={result.last !== score ? result.last : undefined}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
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

const DPAD_BTN_SIZE = 56;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statBox: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 64,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  hint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  grid: {
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  gridRow: {
    flexDirection: "row",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
  // D-pad
  dpad: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  dpadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  dpadCenter: {
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
  },
  dpadBtn: {
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
    borderRadius: Radius.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dpadArrow: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  // Idle / start
  startBtn: {
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
    color: "#fff",
  },
});
