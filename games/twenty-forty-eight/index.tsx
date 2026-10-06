import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  View as RNView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

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
  if (value === 0) {
    return TILE_COLORS[0];
  }
  return TILE_COLORS[value] ?? HIGH_TILE_COLORS;
}

function getTileFontSize(value: number): number {
  if (value < 100) {
    return FontSize.xl;
  }
  if (value < 1000) {
    return FontSize.lg;
  }
  if (value < 10_000) {
    return FontSize.md;
  }
  return FontSize.sm;
}

// ---------------------------------------------------------------------------
// Grid logic
// ---------------------------------------------------------------------------

type Grid = number[][];

function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));
}

function getEmptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (grid[r][c] === 0) {
        cells.push([r, c]);
      }
    }
  }
  return cells;
}

function addRandomTile(grid: Grid): Grid {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) {
    return grid;
  }
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
function slideLine(line: number[]): {
  line: number[];
  score: number;
  moved: boolean;
} {
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
      i += 1;
    }
  }
  // Pad with zeros
  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }
  // Check if anything changed
  for (let j = 0; j < GRID_SIZE; j += 1) {
    if (merged[j] !== line[j]) {
      moved = true;
      break;
    }
  }
  return { line: merged, moved, score };
}

type Direction = "left" | "right" | "up" | "down";

function applyMove(
  grid: Grid,
  direction: Direction
): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const next = createEmptyGrid();

  if (direction === "left") {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const { line, score, moved } = slideLine(grid[r]);
      next[r] = line;
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else if (direction === "right") {
    for (let r = 0; r < GRID_SIZE; r += 1) {
      const reversed = [...grid[r]].reverse();
      const { line, score, moved } = slideLine(reversed);
      next[r] = line.reverse();
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else if (direction === "up") {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const col = grid.map((row) => row[c]);
      const { line, score, moved } = slideLine(col);
      for (let r = 0; r < GRID_SIZE; r += 1) {
        next[r][c] = line[r];
      }
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  } else {
    // down
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const col = grid.map((row) => row[c]).reverse();
      const { line, score, moved } = slideLine(col);
      const reversed = line.reverse();
      for (let r = 0; r < GRID_SIZE; r += 1) {
        next[r][c] = reversed[r];
      }
      totalScore += score;
      if (moved) {
        anyMoved = true;
      }
    }
  }

  return { grid: next, moved: anyMoved, score: totalScore };
}

function hasWon(grid: Grid): boolean {
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      if (grid[r][c] >= 2048) {
        return true;
      }
    }
  }
  return false;
}

function isGameOver(grid: Grid): boolean {
  // Any empty cell?
  if (getEmptyCells(grid).length > 0) {
    return false;
  }
  // Any adjacent equal tiles?
  for (let r = 0; r < GRID_SIZE; r += 1) {
    for (let c = 0; c < GRID_SIZE; c += 1) {
      const v = grid[r][c];
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) {
        return false;
      }
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) {
        return false;
      }
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
    if (value === 0 || value === prev) {
      return;
    }
    if (prev === 0) {
      // Tile appeared in this cell (new tile or slid in): quick pop-in
      scale.value = 0.6;
      scale.value = withTiming(1, {
        duration: 140,
        easing: Easing.out(Easing.quad),
      });
    } else if (value > prev) {
      // Cell value grew: merge pulse
      scale.value = withSequence(
        withTiming(1.15, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 110, easing: Easing.in(Easing.quad) })
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
          backgroundColor: isTransparent ? "transparent" : bgColor,
          borderColor,
          borderRadius: Radius.sm,
          borderWidth: isTransparent ? 1 : 0,
          height: cellSize,
          width: cellSize,
        },
        animStyle,
      ]}
    >
      {value === 0 ? null : (
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
      )}
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

  const storedBest = useGameStore(
    (s) => s.progress["twenty-forty-eight"]?.highScore ?? 0
  );
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("idle");
  const [paused, setPaused] = useState(false);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid);
  const [score, setScore] = useState(0);
  const [moveCount, setMoveCount] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);

  // Track whether we've already triggered a win to avoid double-recording
  const winFiredRef = useRef<boolean>(false);
  // Track whether the game has already ended to avoid double updateProgress
  const gameOverRef = useRef<boolean>(false);

  // Derived cell size based on screen width
  const gridWidth = screenWidth - Spacing.lg * 2;
  const cellSize =
    (gridWidth - GAP * (GRID_SIZE - 1) - PADDING * 2) / GRID_SIZE;

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
      if (gameOverRef.current) {
        return;
      }
      gameOverRef.current = true;
      const update = updateProgress("twenty-forty-eight", finalScore, { won });
      setResult(update);
      setPhase("over");
    },
    [updateProgress]
  );

  // ---------------------------------------------------------------------------
  // Move handling
  // ---------------------------------------------------------------------------

  const handleMove = useCallback(
    (direction: Direction) => {
      if (phase !== "playing" || paused) {
        return;
      }

      setGrid((currentGrid) => {
        const {
          grid: nextGrid,
          score: gained,
          moved,
        } = applyMove(currentGrid, direction);

        if (!moved) {
          return currentGrid;
        }

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
    [phase, paused, haptic, t, endGame]
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderGrid = () => (
    <RNView
      style={[
        styles.grid,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          gap: GAP,
          padding: PADDING,
          width: gridWidth,
        },
      ]}
    >
      {grid.map((row, rIdx) => (
        <RNView key={rIdx} style={[styles.gridRow, { gap: GAP }]}>
          {row.map((value, cIdx) => (
            <Tile
              borderColor={theme.border}
              cellSize={cellSize}
              key={cIdx}
              value={value}
            />
          ))}
        </RNView>
      ))}
    </RNView>
  );

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
            accessibilityLabel={t("a11yMoveUp")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleMove("up")}
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
            onPress={() => handleMove("left")}
            style={dpadBtnStyle}
          >
            <Text style={[styles.dpadArrow, { color: theme.text }]}>◀</Text>
          </Pressable>
          <RNView style={styles.dpadCenter} />
          <Pressable
            accessibilityLabel={t("a11yMoveRight")}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => handleMove("right")}
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
            onPress={() => handleMove("down")}
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
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Pressable
          accessibilityLabel={t("gameTapToStart")}
          accessibilityRole="button"
          onPress={startGame}
          style={[styles.startBtn, { backgroundColor: theme.tint }]}
        >
          <Text style={[styles.startBtnText, { color: theme.onTint }]}>
            {t("gameTapToStart")}
          </Text>
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
          <RNView
            style={[
              styles.statBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("tfeScore")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {score}
            </Text>
          </RNView>
          <RNView
            style={[
              styles.statBox,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("tfeBestTile")}
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
              {t("tfeMoves")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {moveCount}
            </Text>
          </RNView>
        </RNView>
        <GameControls
          isPaused={paused}
          onPause={() => setPaused((p) => !p)}
          onReset={startGame}
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
        onRestart={startGame}
        onResume={() => setPaused(false)}
        visible={paused}
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
          title={winMessage ? t("tfeYouWin") : t("tfeGameOver")}
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
  cell: {
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.lg,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  // D-pad
  dpad: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  dpadArrow: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  dpadBtn: {
    alignItems: "center",
    borderRadius: Radius.button,
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
  grid: {
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  gridRow: {
    flexDirection: "row",
  },
  hint: {
    ...TextStyle.hint,
    textAlign: "center",
  },
  // Idle / start
  startBtn: {
    borderRadius: Radius.button,
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
  },
  statBox: {
    alignItems: "center",
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
  },
  topBar: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
