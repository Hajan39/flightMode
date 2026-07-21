import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Spacing } from "@/constants/Spacing";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View as RNView, useWindowDimensions } from "react-native";

import {
  type Cell,
  checkWin,
  COLS,
  countFlagged,
  floodReveal,
  makeEmptyBoard,
  MINE_COUNT,
  placeMines,
  revealAllMines,
  ROWS,
} from "./logic";

// ─── Constants ────────────────────────────────────────────────────────────────

const GAP = 2;

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
  const { width, height } = useWindowDimensions();
  const haptic = useHaptic();

  const storedBest = useGameStore((s) => s.progress["minesweeper"]?.highScore ?? 0);
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [board, setBoard] = useState<Cell[][]>(makeEmptyBoard);
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
  }, []);

  // ── Cell size ──────────────────────────────────────────────────────────────

  const boardEdge = Math.min(width, height) * 0.9;
  const cellSize = Math.floor((boardEdge - GAP * (COLS - 1)) / COLS);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const resetGame = useCallback(() => {
    stopTimer();
    setBoard(makeEmptyBoard());
    setPhase("idle");
    setOutcome(null);
    setElapsedSeconds(0);
    setFlaggedCount(0);
    setProgressInfo(null);
    setFinalScore(null);
    startTimeRef.current = null;
  }, [stopTimer]);

  // ── Handle reveal ──────────────────────────────────────────────────────────

  const handlePress = useCallback(
    (row: number, col: number) => {
      if (phase === "over") return;

      setBoard((prev) => {
        const cell = prev[row][col];

        // Flagged or already revealed → ignore tap
        if (cell.isFlagged || cell.isRevealed) return prev;

        // ── First tap: plant mines then reveal ────────────────────────────
        if (phase === "idle") {
          const withMines = placeMines(prev, row, col);
          const revealed = floodReveal(withMines, row, col);
          // Check immediate win (extremely unlikely but correct)
          if (checkWin(revealed)) {
            stopTimer();
            const score = Math.max(100, 1000 - 0 * 5);
            const info = updateProgress("minesweeper", score);
            setProgressInfo(info);
            setFinalScore(score);
            setPhase("over");
            setOutcome("win");
            haptic.success();
            return revealed;
          }
          setPhase("playing");
          startTimer();
          return revealed;
        }

        // ── Mine hit → lose ───────────────────────────────────────────────
        if (cell.isMine) {
          stopTimer();
          haptic.error();
          const revealed = revealAllMines(prev);
          const info = updateProgress("minesweeper", 0, { won: false });
          setProgressInfo(info);
          setFinalScore(0);
          setPhase("over");
          setOutcome("lose");
          return revealed;
        }

        // ── Safe cell → reveal (flood if 0) ──────────────────────────────
        const revealed = floodReveal(prev, row, col);
        if (checkWin(revealed)) {
          stopTimer();
          haptic.success();
          const elapsed = startTimeRef.current
            ? Math.floor((Date.now() - startTimeRef.current) / 1000)
            : 0;
          const score = Math.max(100, 1000 - elapsed * 5);
          const info = updateProgress("minesweeper", score);
          setProgressInfo(info);
          setFinalScore(score);
          setPhase("over");
          setOutcome("win");
        }
        return revealed;
      });
    },
    [phase, haptic, startTimer, stopTimer, updateProgress],
  );

  // ── Handle flag ────────────────────────────────────────────────────────────

  const handleLongPress = useCallback(
    (row: number, col: number) => {
      if (phase === "over" || phase === "idle") return;

      setBoard((prev) => {
        const cell = prev[row][col];
        if (cell.isRevealed) return prev;

        const next = prev.map((r) => r.map((c) => ({ ...c })));
        const toggled = !cell.isFlagged;
        next[row][col] = { ...cell, isFlagged: toggled };

        // Update flag count derived from new board state
        setFlaggedCount(countFlagged(next));
        haptic.tap();
        return next;
      });
    },
    [phase, haptic],
  );

  // ── Render cell ────────────────────────────────────────────────────────────

  const renderCell = (cell: Cell, row: number, col: number) => {
    const key = `${row}-${col}`;

    let bg = theme.elevated;
    let content: React.ReactNode = null;

    if (cell.isRevealed) {
      if (cell.isMine) {
        bg = "#e53935";
        content = <Text style={styles.cellEmoji}>💣</Text>;
      } else if (cell.adjacentMines > 0) {
        bg = theme.surface ?? theme.card;
        content = (
          <Text
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
        bg = theme.surface ?? theme.card;
      }
    } else if (cell.isFlagged) {
      // In win state, flagged mines stay as flags
      bg = theme.elevated;
      content = <Text style={styles.cellEmoji}>🚩</Text>;
    } else {
      // Covered
      bg = theme.elevated;
    }

    const isDisabled = phase === "over" || cell.isRevealed;

    return (
      <Pressable
        key={key}
        onPress={() => handlePress(row, col)}
        onLongPress={() => handleLongPress(row, col)}
        delayLongPress={350}
        disabled={isDisabled && phase !== "idle"}
        style={[
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor: bg,
            borderColor: cell.isRevealed ? "transparent" : theme.border,
            borderWidth: cell.isRevealed ? 0 : 1,
            borderRadius: Radius.sm,
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
    <View style={styles.root}>
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
        <GameControls onReset={resetGame} hidePause />
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

      {/* ── Game result overlay ── */}
      {phase === "over" && finalScore !== null && (
        <GameResult
          title={outcome === "win" ? t("msYouWin") : t("msGameOver")}
          score={finalScore}
          best={progressInfo?.best ?? storedBest}
          last={progressInfo?.previousBest}
          streak={progressInfo?.currentStreak}
          isNewBest={progressInfo?.isNewBest}
          onPlayAgain={resetGame}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    alignItems: "center",
  },
  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statBlock: {
    alignItems: "center",
    minWidth: 56,
    gap: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  // ── Board ──
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  board: {
    flexDirection: "column",
  },
  boardRow: {
    flexDirection: "row",
  },
  // ── Cell ──
  cell: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cellNumber: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 16,
  },
  cellEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  // ── Hint ──
  hintText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    paddingBottom: Spacing.sm,
  },
});
