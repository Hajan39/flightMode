import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  View as RNView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import GameControls from "@/components/GameControls";
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

import {
  buildPuzzle,
  lineBetween,
  readCells,
  type Placement,
  type Puzzle,
} from "./logic";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_SIZE = 8;
const WORD_COUNT = 6;
const GAP = 3;

/** Aviation / travel words — all 5 letters so they tile an 8×8 grid nicely. */
const WORD_POOL = [
  "PILOT",
  "CABIN",
  "CARGO",
  "RADAR",
  "TOWER",
  "ROUTE",
  "CLOUD",
  "GATES",
  "WINGS",
  "PLANE",
  "BOARD",
  "MILES",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "playing" | "paused" | "over";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (component-side, uses Math.random). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a fresh puzzle whose placements all resolve to real words. */
function makePuzzle(): { puzzle: Puzzle; words: string[] } {
  // Retry until we get WORD_COUNT successful placements (rare to need >1 pass).
  for (let attempt = 0; attempt < 25; attempt++) {
    const words = shuffle(WORD_POOL).slice(0, WORD_COUNT);
    const puzzle = buildPuzzle(words, GRID_SIZE, Math.random);
    if (puzzle.placements.length === WORD_COUNT) {
      return { puzzle, words: puzzle.placements.map((p) => p.word) };
    }
  }
  // Fallback: accept whatever placed (still a valid, readable puzzle).
  const words = shuffle(WORD_POOL).slice(0, WORD_COUNT);
  const puzzle = buildPuzzle(words, GRID_SIZE, Math.random);
  return { puzzle, words: puzzle.placements.map((p) => p.word) };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WordSearchGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const haptic = useHaptic();

  const storedBest = useGameStore(
    (s) => s.progress["word-search"]?.highScore ?? 0,
  );
  const updateProgress = useGameStore((s) => s.updateProgress);

  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle().puzzle);
  const [phase, setPhase] = useState<Phase>("playing");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<number>>(new Set());
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null,
  );

  // ── Refs ──
  const startTimeRef = useRef<number>(Date.now());
  const accumulatedRef = useRef<number>(0); // seconds banked across pauses
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solvedRef = useRef(false); // guards single updateProgress call
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Timer ──
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const live =
        accumulatedRef.current +
        (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(Math.floor(live));
    }, 500);
  }, [stopTimer]);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  // ── Fresh game ──
  const resetGame = useCallback(() => {
    stopTimer();
    solvedRef.current = false;
    accumulatedRef.current = 0;
    setPuzzle(makePuzzle().puzzle);
    setFoundWords([]);
    setFoundCells(new Set());
    setSelectedStart(null);
    setElapsedSeconds(0);
    setFinalScore(null);
    setProgressInfo(null);
    setPhase("playing");
    startTimer();
  }, [startTimer, stopTimer]);

  // ── Pause / resume ──
  const handlePause = useCallback(() => {
    if (phase !== "playing") return;
    accumulatedRef.current += (Date.now() - startTimeRef.current) / 1000;
    stopTimer();
    setPhase("paused");
  }, [phase, stopTimer]);

  const handleResume = useCallback(() => {
    if (phase !== "paused") return;
    setPhase("playing");
    startTimer();
  }, [phase, startTimer]);

  // ── Shake feedback on a bad selection ──
  const triggerShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Win handling (single updateProgress) ──
  const finishGame = useCallback(
    (elapsed: number) => {
      if (solvedRef.current) return;
      solvedRef.current = true;
      stopTimer();
      haptic.success();
      const score = Math.max(200, 2000 - elapsed * 10);
      const info = updateProgress("word-search", score, { won: true });
      setProgressInfo(info);
      setFinalScore(score);
      setPhase("over");
    },
    [haptic, stopTimer, updateProgress],
  );

  // ── Cell tap ──
  const handleCellTap = useCallback(
    (index: number) => {
      if (phase !== "playing") return;

      // First tap selects the start cell.
      if (selectedStart === null) {
        haptic.tap();
        setSelectedStart(index);
        return;
      }

      // Tapping the same cell cancels the selection.
      if (selectedStart === index) {
        haptic.tap();
        setSelectedStart(null);
        return;
      }

      const line = lineBetween(selectedStart, index, GRID_SIZE);
      setSelectedStart(null);

      if (!line) {
        haptic.error();
        triggerShake();
        return;
      }

      const forward = readCells(puzzle.grid, line);
      const backward = forward.split("").reverse().join("");

      const match = puzzle.placements.find(
        (p: Placement) =>
          !foundWords.includes(p.word) &&
          (p.word === forward || p.word === backward),
      );

      if (!match) {
        haptic.error();
        triggerShake();
        return;
      }

      // Found a new word.
      haptic.success();
      const nextFound = [...foundWords, match.word];
      const nextCells = new Set(foundCells);
      for (const c of match.cells) nextCells.add(c);
      setFoundWords(nextFound);
      setFoundCells(nextCells);

      if (nextFound.length >= puzzle.placements.length) {
        const elapsed =
          accumulatedRef.current + (Date.now() - startTimeRef.current) / 1000;
        finishGame(Math.floor(elapsed));
      }
    },
    [
      phase,
      selectedStart,
      puzzle,
      foundWords,
      foundCells,
      haptic,
      triggerShake,
      finishGame,
    ],
  );

  // ── Layout ──
  const boardEdge = Math.min(width, height) * 0.9;
  const cellSize = Math.floor((boardEdge - GAP * (GRID_SIZE - 1)) / GRID_SIZE);

  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-8, 8],
  });

  // ── Render a single cell ──
  const renderCell = (index: number) => {
    const letter = puzzle.grid[index];
    const isFound = foundCells.has(index);
    const isSelected = selectedStart === index;

    let bg = theme.elevated;
    let color = theme.text;
    if (isFound) {
      bg = theme.tint;
      color = "#ffffff";
    } else if (isSelected) {
      bg = theme.warning;
      color = "#ffffff";
    }

    return (
      <Pressable
        key={index}
        onPress={() => handleCellTap(index)}
        disabled={phase !== "playing"}
        style={[
          styles.cell,
          {
            width: cellSize,
            height: cellSize,
            backgroundColor: bg,
            borderColor: isSelected ? theme.warning : theme.border,
            borderRadius: Radius.sm,
          },
        ]}
      >
        <Text style={[styles.cellLetter, { color }]}>{letter}</Text>
      </Pressable>
    );
  };

  const rows: number[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    rows.push(
      Array.from({ length: GRID_SIZE }, (_, c) => r * GRID_SIZE + c),
    );
  }

  return (
    <View style={styles.root}>
      {/* Header: stats + controls */}
      <RNView style={styles.header}>
        <RNView style={styles.statsRow}>
          <RNView style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("wsFound")}
            </Text>
            <Text style={[styles.statValue, { color: theme.tint }]}>
              {foundWords.length}/{puzzle.placements.length}
            </Text>
          </RNView>
          <RNView style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <RNView style={styles.statBlock}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("msTime")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {elapsedSeconds}s
            </Text>
          </RNView>
        </RNView>

        <GameControls
          onPause={phase === "playing" ? handlePause : undefined}
          onReset={resetGame}
          isPaused={phase === "paused"}
        />
      </RNView>

      {/* Board */}
      <RNView style={styles.boardWrapper}>
        <Animated.View
          style={[styles.board, { gap: GAP, transform: [{ translateX: shakeTranslate }] }]}
        >
          {rows.map((row, rIdx) => (
            <RNView key={rIdx} style={[styles.boardRow, { gap: GAP }]}>
              {row.map((index) => renderCell(index))}
            </RNView>
          ))}
        </Animated.View>
      </RNView>

      {/* Word list */}
      <RNView style={styles.wordSection}>
        <Text style={[styles.wordSectionLabel, { color: theme.mutedText }]}>
          {t("wsWords")}
        </Text>
        <RNView style={styles.wordList}>
          {puzzle.placements.map((p: Placement) => {
            const found = foundWords.includes(p.word);
            return (
              <RNView
                key={p.word}
                style={[
                  styles.wordChip,
                  {
                    backgroundColor: found ? theme.tint : theme.card,
                    borderColor: found ? theme.tint : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.wordChipText,
                    {
                      color: found ? "#ffffff" : theme.text,
                      textDecorationLine: found ? "line-through" : "none",
                    },
                  ]}
                >
                  {p.word}
                </Text>
              </RNView>
            );
          })}
        </RNView>
      </RNView>

      {/* Result overlay */}
      {phase === "over" && finalScore !== null && (
        <GameResult
          title={t("youWin")}
          score={finalScore}
          best={progressInfo?.best ?? storedBest}
          last={progressInfo?.previousBest}
          streak={progressInfo?.currentStreak}
          isNewBest={progressInfo?.isNewBest}
          onPlayAgain={resetGame}
        />
      )}

      {/* Pause overlay */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={resetGame}
      />
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
    justifyContent: "center",
    alignItems: "center",
  },
  board: {
    flexDirection: "column",
  },
  boardRow: {
    flexDirection: "row",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  cellLetter: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },
  // ── Word list ──
  wordSection: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: Spacing.sm,
  },
  wordSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wordList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  wordChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  wordChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
});
