import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
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
import { useAutoPause } from "@/hooks/useAutoPause";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import {
  type Cell,
  COLS,
  countFlagged,
  MINE_COUNT,
  makeEmptyBoard,
  resolveTap,
  toggleFlag,
} from "./logic";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAP = 2;
/** Cap system font scaling inside the fixed-size cells so digits never overflow. */
const CELL_FONT_SCALE = 1.3;

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "over";
type Outcome = "win" | "lose" | null;

// ─── Number colours ───────────────────────────────────────────────────────────

const NUMBER_COLORS: Record<number, string> = {
  1: "#1e88e5",
  2: "#43a047",
  3: "#e53935",
  4: "#5e35b1",
  5: "#d81b60",
  6: "#00897b",
  7: "#000000",
  8: "#9e9e9e",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MinesweeperGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const { width, height } = useGameDimensions();
  const haptic = useHaptic();

  const storedBest = useGameStore(
    (s) => s.progress.minesweeper?.highScore ?? 0
  );
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [board, setBoard] = useState<Cell[][]>(makeEmptyBoard);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );
  const [finalScore, setFinalScore] = useState<number | null>(null);
  /** Only set by leaving the app (no pause button: the board is untimed until the first tap). */
  const [paused, setPaused] = useState(false);
  const pausedAtRef = useRef<number | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest board + game flags, updated synchronously so two very fast taps
  // can't both plant mines or both record a result (setState updaters may run
  // lazily / twice, so no side effects live inside them).
  const boardRef = useRef<Cell[][]>(board);
  const minesPlacedRef = useRef(false);
  const overRef = useRef(false);

  const commitBoard = useCallback((next: Cell[][]) => {
    boardRef.current = next;
    setBoard(next);
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const runClock = useCallback(() => {
    timerRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(
          Math.floor((Date.now() - startTimeRef.current) / 1000)
        );
      }
    }, 1000);
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    runClock();
  }, [runClock]);

  const pause = () => {
    stopTimer();
    pausedAtRef.current = Date.now();
    setPaused(true);
  };

  // Leaving the app pauses the clock (the score is time-based); resuming is
  // manual from the pause overlay.
  useAutoPause(pause, phase === "playing" && !paused);

  const resume = () => {
    const pausedAt = pausedAtRef.current;
    pausedAtRef.current = null;
    if (pausedAt !== null && startTimeRef.current !== null) {
      startTimeRef.current += Date.now() - pausedAt;
    }
    setPaused(false);
    runClock();
  };

  // ── Cell size ──────────────────────────────────────────────────────────────

  const boardEdge = Math.min(width, height) * 0.9;
  const cellSize = Math.floor((boardEdge - GAP * (COLS - 1)) / COLS);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    stopTimer();
    minesPlacedRef.current = false;
    overRef.current = false;
    commitBoard(makeEmptyBoard());
    setPhase("idle");
    setOutcome(null);
    setElapsedSeconds(0);
    setFlaggedCount(0);
    setProgressInfo(null);
    setFinalScore(null);
    setPaused(false);
    pausedAtRef.current = null;
    startTimeRef.current = null;
  }, [stopTimer, commitBoard]);

  // ── Handle reveal ──────────────────────────────────────────────────────────

  const handlePress = useCallback(
    (row: number, col: number) => {
      if (phase === "over" || overRef.current) {
        return;
      }

      const { board: next, result } = resolveTap(
        boardRef.current,
        row,
        col,
        minesPlacedRef.current
      );
      if (result === "ignored") {
        return;
      }
      const firstTap = !minesPlacedRef.current;
      minesPlacedRef.current = true;
      commitBoard(next);

      if (result === "started") {
        setPhase("playing");
        startTimer();
        return;
      }
      if (result === "safe") {
        return;
      }

      overRef.current = true;
      stopTimer();
      if (result === "lose") {
        haptic.error();
        setProgressInfo(updateProgress("minesweeper", 0, { won: false }));
        setFinalScore(0);
        setPhase("over");
        setOutcome("lose");
        return;
      }

      // Win (on the first tap: extremely unlikely but correct).
      haptic.success();
      const elapsed =
        !firstTap && startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;
      const score = Math.max(100, 1000 - elapsed * 5);
      setProgressInfo(updateProgress("minesweeper", score));
      setFinalScore(score);
      setPhase("over");
      setOutcome("win");
    },
    [phase, haptic, startTimer, stopTimer, updateProgress, commitBoard]
  );

  // ── Handle flag ────────────────────────────────────────────────────────────

  const handleLongPress = useCallback(
    (row: number, col: number) => {
      if (phase === "over" || phase === "idle" || overRef.current) {
        return;
      }
      const next = toggleFlag(boardRef.current, row, col);
      if (next === boardRef.current) {
        return;
      }
      commitBoard(next);
      setFlaggedCount(countFlagged(next));
      haptic.tap();
    },
    [phase, haptic, commitBoard]
  );

  // ── Render cell ────────────────────────────────────────────────────────────

  const renderCell = (cell: Cell, row: number, col: number) => {
    const key = `${row}-${col}`;

    let bg = theme.elevated;
    let content: React.ReactNode = null;

    if (cell.isRevealed) {
      if (cell.isMine) {
        bg = theme.danger;
        content = (
          <Text
            maxFontSizeMultiplier={CELL_FONT_SCALE}
            style={styles.cellEmoji}
          >
            💣
          </Text>
        );
      } else if (cell.adjacentMines > 0) {
        bg = theme.background;
        content = (
          <Text
            maxFontSizeMultiplier={CELL_FONT_SCALE}
            style={[
              styles.cellNumber,
              { color: NUMBER_COLORS[cell.adjacentMines] ?? theme.text },
            ]}
          >
            {cell.adjacentMines}
          </Text>
        );
      } else {
        // Empty revealed cell
        bg = theme.background;
      }
    } else if (cell.isFlagged) {
      // In win state, flagged mines stay as flags
      bg = theme.elevated;
      content = (
        <Text maxFontSizeMultiplier={CELL_FONT_SCALE} style={styles.cellEmoji}>
          🚩
        </Text>
      );
    } else {
      // Covered
      bg = theme.elevated;
    }

    const isDisabled = phase === "over" || cell.isRevealed;

    return (
      <Pressable
        delayLongPress={350}
        disabled={isDisabled && phase !== "idle"}
        key={key}
        onLongPress={() => handleLongPress(row, col)}
        onPress={() => handlePress(row, col)}
        style={[
          styles.cell,
          {
            backgroundColor: bg,
            borderColor: cell.isRevealed ? "transparent" : theme.border,
            borderRadius: Radius.sm,
            borderWidth: cell.isRevealed ? 0 : 1,
            height: cellSize,
            width: cellSize,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  };

  // ── Stat helpers ───────────────────────────────────────────────────────────

  const timeLabel = `${elapsedSeconds}s`;
  const flagLabel = `${flaggedCount}/${MINE_COUNT}`;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <A11yOverlayScope>
      <View style={styles.screen}>
        <A11yOverlayContent style={styles.root}>
          {/* ── Header: stats + controls ── */}
          <RNView style={styles.header}>
            {/* Stats */}
            <RNView style={styles.statsRow}>
              <RNView style={styles.statBlock}>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                  {t("msFlags")}
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {flagLabel}
                </Text>
              </RNView>
              <RNView
                style={[styles.statDivider, { backgroundColor: theme.border }]}
              />
              <RNView style={styles.statBlock}>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                  {t("msTime")}
                </Text>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {timeLabel}
                </Text>
              </RNView>
              <RNView
                style={[styles.statDivider, { backgroundColor: theme.border }]}
              />
              <RNView style={styles.statBlock}>
                <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                  {t("msMines")}
                </Text>
                <Text style={[styles.statValue, { color: theme.tint }]}>
                  {MINE_COUNT}
                </Text>
              </RNView>
            </RNView>

            {/* Controls: reset only, no pause */}
            <GameControls hidePause onReset={resetGame} />
          </RNView>

          {/* ── Board ── */}
          <RNView style={styles.boardWrapper}>
            <RNView style={[styles.board, { gap: GAP }]}>
              {board.map((row, rIdx) => (
                <RNView key={rIdx} style={[styles.boardRow, { gap: GAP }]}>
                  {row.map((cell, cIdx) => renderCell(cell, rIdx, cIdx))}
                </RNView>
              ))}
            </RNView>
          </RNView>

          {/* ── Hint text when idle ── */}
          {phase === "idle" && (
            <Text style={[styles.hintText, { color: theme.mutedText }]}>
              {t("msRevealHint")}
            </Text>
          )}
        </A11yOverlayContent>
        <GamePauseOverlay
          onRestart={resetGame}
          onResume={resume}
          visible={paused && phase === "playing"}
        />

        {/* ── Game result overlay ── */}
        {phase === "over" && finalScore !== null && (
          <GameResult
            best={progressInfo?.best ?? storedBest}
            isNewBest={progressInfo?.isNewBest}
            last={progressInfo?.previousBest}
            onPlayAgain={resetGame}
            score={finalScore}
            streak={progressInfo?.currentStreak}
            title={outcome === "win" ? t("msYouWin") : t("msGameOver")}
          />
        )}
      </View>
    </A11yOverlayScope>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  board: {
    flexDirection: "column",
  },
  boardRow: {
    flexDirection: "row",
  },
  // ── Board ──
  boardWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  // ── Cell ──
  cell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  cellNumber: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  // ── Header ──
  header: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // ── Hint ──
  hintText: {
    fontSize: 13,
    fontWeight: "600",
    paddingBottom: Spacing.sm,
    textAlign: "center",
  },
  root: {
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  screen: { flex: 1 },
  statBlock: {
    alignItems: "center",
    gap: 1,
    minWidth: 56,
  },
  statDivider: {
    height: 36,
    width: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
});
