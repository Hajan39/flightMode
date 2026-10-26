import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  A11yOverlayContent,
  A11yOverlayScope,
} from "@/components/A11yOverlayScope";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useSwipe } from "@/hooks/useSwipe";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  createEmptyGrid,
  createInitialGrid,
  type Direction,
  GRID_SIZE,
  type Grid,
  playMove,
} from "./logic";

/** Cap system font scaling inside fixed-size board cells so text never overflows them. */
const CELL_FONT_SCALE = 1.3;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
          maxFontSizeMultiplier={CELL_FONT_SCALE}
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
  const { width: screenWidth } = useGameDimensions();

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
  // Latest grid / score, updated synchronously with each move.
  const gridRef = useRef<Grid>(grid);
  const scoreRef = useRef(0);

  // Derived cell size based on screen width
  const gridWidth = screenWidth - Spacing.lg * 2;
  const cellSize =
    (gridWidth - GAP * (GRID_SIZE - 1) - PADDING * 2) / GRID_SIZE;

  // ---------------------------------------------------------------------------
  // Game lifecycle
  // ---------------------------------------------------------------------------

  const startGame = useCallback(() => {
    const initial = createInitialGrid();
    gridRef.current = initial;
    scoreRef.current = 0;
    setGrid(initial);
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
      if (phase !== "playing" || paused || gameOverRef.current) {
        return;
      }

      // Computed from refs (latest committed values) outside any updater:
      // updaters may run lazily or twice, so side effects can't live in them.
      const move = playMove(gridRef.current, direction);
      if (!move.moved) {
        return;
      }
      haptic.tap();
      const newScore = scoreRef.current + move.gained;
      gridRef.current = move.grid;
      scoreRef.current = newScore;
      setGrid(move.grid);
      setScore(newScore);
      setMoveCount((prev) => prev + 1);

      // Check win (2048 reached for the first time)
      if (!winFiredRef.current && move.reached2048) {
        winFiredRef.current = true;
        setWinMessage(t("tfeYouWin"));
        haptic.success();
        endGame(newScore, true);
      } else if (move.over) {
        haptic.error();
        endGame(newScore, false);
      }
    },
    [phase, paused, haptic, t, endGame]
  );

  const swipeProps = useSwipe(handleMove);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderGrid = () => (
    <RNView
      {...swipeProps}
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
    <A11yOverlayScope>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <A11yOverlayContent style={styles.container}>
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
        </A11yOverlayContent>
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
    </A11yOverlayScope>
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
  screen: { flex: 1 },
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
