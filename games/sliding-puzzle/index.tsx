import GameControls from "@/components/GameControls";
import GameCountdown from "@/components/GameCountdown";
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
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet, useWindowDimensions } from "react-native";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE = 4; // 4x4 board
const TOTAL = SIZE * SIZE; // 16 slots
const EMPTY = 0; // sentinel for the empty slot
const SHUFFLE_MOVES = 200; // random valid slides from the solved board
const GAP = 8;
const PADDING = 12;

// ---------------------------------------------------------------------------
// Board logic
// ---------------------------------------------------------------------------

type Board = number[]; // flat length-16 array; EMPTY (0) marks the gap

function solvedBoard(): Board {
  // [1, 2, 3, ..., 15, 0]
  const b: Board = [];
  for (let i = 1; i < TOTAL; i++) b.push(i);
  b.push(EMPTY);
  return b;
}

function isSolved(board: Board): boolean {
  for (let i = 0; i < TOTAL - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[TOTAL - 1] === EMPTY;
}

/** Indices orthogonally adjacent to `idx` on the 4x4 grid. */
function neighborIndices(idx: number): number[] {
  const row = Math.floor(idx / SIZE);
  const col = idx % SIZE;
  const out: number[] = [];
  if (row > 0) out.push(idx - SIZE); // up
  if (row < SIZE - 1) out.push(idx + SIZE); // down
  if (col > 0) out.push(idx - 1); // left
  if (col < SIZE - 1) out.push(idx + 1); // right
  return out;
}

/**
 * Build a guaranteed-solvable board by starting from the solved state and
 * applying `SHUFFLE_MOVES` random *valid* slides. We never build a random
 * permutation (half of which are unsolvable), and we avoid immediately
 * undoing the previous move for a more thorough shuffle.
 */
function makeShuffledBoard(): Board {
  const board = solvedBoard();
  let emptyIdx = TOTAL - 1;
  let prevEmpty = -1;
  for (let step = 0; step < SHUFFLE_MOVES; step++) {
    const options = neighborIndices(emptyIdx).filter((n) => n !== prevEmpty);
    const pick = options[Math.floor(Math.random() * options.length)];
    board[emptyIdx] = board[pick];
    board[pick] = EMPTY;
    prevEmpty = emptyIdx;
    emptyIdx = pick;
  }
  // Extremely unlikely, but never hand the player an already-solved board.
  if (isSolved(board)) return makeShuffledBoard();
  return board;
}

function computeScore(moves: number, elapsedSeconds: number): number {
  return Math.max(200, 3000 - moves * 10 - elapsedSeconds * 5);
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "idle" | "countdown" | "playing" | "paused" | "over";

export default function SlidingPuzzleGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const updateProgress = useGameStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<Phase>("idle");
  const [board, setBoard] = useState<Board>(solvedBoard);
  const [moves, setMoves] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // Wall-clock timer refs (never chained-setTimeout tick counting).
  const startTimeRef = useRef<number>(0);
  const pausedAccumulatedRef = useRef<number>(0);
  // Synchronous guard so updateProgress fires exactly once per solve.
  const solvedRef = useRef(false);

  // Derived cell size based on screen width.
  const gridWidth = screenWidth - Spacing.lg * 2;
  const cellSize = (gridWidth - GAP * (SIZE - 1) - PADDING * 2) / SIZE;

  // ── Wall-clock timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setElapsedSeconds(
        pausedAccumulatedRef.current +
          Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  const prepareBoard = useCallback(() => {
    setBoard(makeShuffledBoard());
    setMoves(0);
    setScore(0);
    setElapsedSeconds(0);
    setResult(null);
    pausedAccumulatedRef.current = 0;
    solvedRef.current = false;
    setPhase("countdown");
    haptic.tap();
  }, [haptic]);

  const onCountdownComplete = useCallback(() => {
    pausedAccumulatedRef.current = 0;
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setPhase("playing");
  }, []);

  const handlePause = useCallback(() => {
    pausedAccumulatedRef.current += Math.floor(
      (Date.now() - startTimeRef.current) / 1000,
    );
    setPhase("paused");
  }, []);

  const handleResume = useCallback(() => {
    startTimeRef.current = Date.now();
    setPhase("playing");
  }, []);

  // ── Tile tap ──────────────────────────────────────────────────────────────

  const handleTilePress = useCallback(
    (idx: number) => {
      if (phase !== "playing") return;
      if (board[idx] === EMPTY) return;

      const emptyIdx = board.indexOf(EMPTY);
      if (!neighborIndices(idx).includes(emptyIdx)) return; // not adjacent

      haptic.tap();

      const next = [...board];
      next[emptyIdx] = next[idx];
      next[idx] = EMPTY;
      setBoard(next);

      const nextMoves = moves + 1;
      setMoves(nextMoves);

      if (isSolved(next) && !solvedRef.current) {
        solvedRef.current = true;
        const winElapsed =
          pausedAccumulatedRef.current +
          Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(winElapsed);
        const finalScore = computeScore(nextMoves, winElapsed);
        setScore(finalScore);
        haptic.success();
        const update = updateProgress("sliding-puzzle", finalScore, { won: true });
        setResult(update);
        setPhase("over");
      }
    },
    [phase, board, moves, haptic, updateProgress],
  );

  // ---------------------------------------------------------------------------
  // Idle screen
  // ---------------------------------------------------------------------------

  if (phase === "idle") {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <RNView style={styles.idleContainer}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t("gameSlidingPuzzleName")}
          </Text>
          <Text style={[styles.description, { color: theme.mutedText }]}>
            {t("gameSlidingPuzzleDescription")}
          </Text>
          <Pressable
            style={[styles.startBtn, { backgroundColor: theme.tint }]}
            onPress={prepareBoard}
          >
            <Text style={styles.startBtnText}>{t("gameTapToStart")}</Text>
          </Pressable>
        </RNView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main game screen
  // ---------------------------------------------------------------------------

  const interactive = phase === "playing";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top bar: stats + controls */}
      <RNView style={styles.topBar}>
        <RNView style={styles.statsRow}>
          <RNView
            style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("spMoves")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>{moves}</Text>
          </RNView>
          <RNView
            style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("spTime")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTime(elapsedSeconds)}
            </Text>
          </RNView>
        </RNView>
        <GameControls
          onPause={handlePause}
          onReset={prepareBoard}
          isPaused={phase === "paused"}
        />
      </RNView>

      {/* Grid */}
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
        {Array.from({ length: SIZE }, (_, row) => (
          <RNView key={row} style={[styles.gridRow, { gap: GAP }]}>
            {Array.from({ length: SIZE }, (_, col) => {
              const idx = row * SIZE + col;
              const value = board[idx];
              const isEmpty = value === EMPTY;
              return (
                <Pressable
                  key={col}
                  onPress={() => handleTilePress(idx)}
                  disabled={isEmpty || !interactive}
                  style={[
                    styles.cell,
                    {
                      width: cellSize,
                      height: cellSize,
                      borderRadius: Radius.sm,
                      backgroundColor: isEmpty ? "transparent" : theme.tint,
                      borderWidth: isEmpty ? 1 : 0,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {!isEmpty ? (
                    <Text style={styles.cellText}>{value}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </RNView>
        ))}
      </RNView>

      {/* Hint */}
      <Text style={[styles.hint, { color: theme.mutedText }]}>
        {t("rulesSlidingPuzzle")}
      </Text>

      {/* Countdown overlay */}
      {phase === "countdown" ? (
        <GameCountdown onComplete={onCountdownComplete} />
      ) : null}

      {/* Pause overlay */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={prepareBoard}
      />

      {/* Result overlay */}
      {phase === "over" && result ? (
        <GameResult
          title={t("spSolved")}
          score={score}
          best={result.best}
          last={result.last !== score ? result.last : undefined}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          isNewBest={result.isNewBest}
          onPlayAgain={prepareBoard}
          subtitle={`${moves} ${t("spMoves")} · ${formatTime(elapsedSeconds)}`}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  idleContainer: {
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
  },
  title: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    letterSpacing: 1,
    textAlign: "center",
  },
  description: {
    fontSize: FontSize.base,
    textAlign: "center",
    lineHeight: FontSize.base * 1.5,
    maxWidth: 280,
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
    minWidth: 72,
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
    color: "#fff",
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    textAlign: "center",
  },
  startBtn: {
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
    color: "#fff",
  },
});
