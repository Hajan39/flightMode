import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View as RNView,
  type ViewStyle,
} from "react-native";
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

import { PUZZLES } from "./puzzles";
import {
  computeErrors,
  formatTime,
  getCol,
  getRow,
  isPeer,
  isSolved,
} from "./logic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Difficulty = "easy" | "medium" | "hard";
type Phase = "idle" | "selecting" | "playing" | "paused" | "over";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pure helpers live in ./logic (unit-tested).

// ---------------------------------------------------------------------------
// Animated pressables
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a subtle press-in bounce (numpad keys). */
function BouncyPressable({
  style,
  disabled,
  onPress,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      damping: 14,
      stiffness: 320,
      useNativeDriver: true,
    }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => springTo(0.88)}
      onPressOut={() => springTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SudokuGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  const updateProgress = useGameStore((s) => s.updateProgress);

  // ── Phase & game state ──────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [board, setBoard] = useState<number[]>(Array(81).fill(0));
  const [clues, setClues] = useState<number[]>(Array(81).fill(0));
  const [solution, setSolution] = useState<number[]>(Array(81).fill(0));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(3);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState<GameProgressUpdate | null>(null);

  // Wall-clock timer refs
  const startTimeRef = useRef<number>(0);
  const pausedAccumulatedRef = useRef<number>(0);
  // Synchronous solved guard so the two win paths (number input, hint) can
  // never both record the game.
  const solvedRef = useRef(false);

  // ── Animations ──────────────────────────────────────────────────────────
  const selectPulse = useRef(new Animated.Value(1)).current;
  const gridShake = useRef(new Animated.Value(0)).current;

  // Subtle pop when a cell becomes selected
  useEffect(() => {
    if (selectedCell === null) return;
    selectPulse.setValue(0.85);
    Animated.spring(selectPulse, {
      toValue: 1,
      damping: 13,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [selectedCell, selectPulse]);

  // Horizontal shake on invalid entry
  const triggerShake = useCallback(() => {
    gridShake.setValue(0);
    Animated.sequence([
      Animated.timing(gridShake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(gridShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [gridShake]);

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setElapsedSeconds(
        pausedAccumulatedRef.current +
          Math.floor((Date.now() - startTimeRef.current) / 1000),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Grid sizing ─────────────────────────────────────────────────────────
  const gridPadding = Spacing.lg * 2;
  const cellSize = Math.floor((screenWidth - gridPadding) / 9);

  // ── Start puzzle ─────────────────────────────────────────────────────────
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const pool = PUZZLES.filter((p) => p.difficulty === difficulty);
      const puzzle = pool[Math.floor(Math.random() * pool.length)];

      setClues([...puzzle.clues]);
      setSolution([...puzzle.solution]);
      setBoard([...puzzle.clues]);
      setSelectedCell(null);
      setErrors(new Set());
      setHintsLeft(3);
      setHintsUsed(0);
      pausedAccumulatedRef.current = 0;
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setSelectedDifficulty(difficulty);
      solvedRef.current = false;
      setPhase("playing");
      haptic.tap();
    },
    [haptic],
  );

  // ── Reset to idle ────────────────────────────────────────────────────────
  const resetToIdle = useCallback(() => {
    setPhase("idle");
    setSelectedDifficulty(null);
    setResult(null);
    setSelectedCell(null);
  }, []);

  // ── Pause / resume ───────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    pausedAccumulatedRef.current +=
      Math.floor((Date.now() - startTimeRef.current) / 1000);
    setPhase("paused");
  }, []);

  const handleResume = useCallback(() => {
    startTimeRef.current = Date.now();
    setPhase("playing");
  }, []);

  // ── Cell tap ─────────────────────────────────────────────────────────────
  const handleCellPress = useCallback(
    (idx: number) => {
      if (phase !== "playing") return;
      if (clues[idx] !== 0) return;
      haptic.tap();
      setSelectedCell((prev) => (prev === idx ? null : idx));
    },
    [phase, clues, haptic],
  );

  // ── Number input ─────────────────────────────────────────────────────────
  const handleNumberInput = useCallback(
    (num: number) => {
      if (phase !== "playing" || selectedCell === null) return;
      if (clues[selectedCell] !== 0) return;

      haptic.tap();

      let next: number[] = [];
      setBoard((prev) => {
        next = [...prev];
        next[selectedCell] = num;
        return next;
      });

      const newErrors = computeErrors(next, solution);
      setErrors(newErrors);
      if (newErrors.has(selectedCell)) triggerShake();

      const won = isSolved(next, solution);
      if (won && !solvedRef.current) {
        solvedRef.current = true;
        haptic.success();
        const finalScore = Math.max(
          500,
          5000 - elapsedSeconds * 8 - hintsUsed * 200,
        );
        const extraOpts =
          selectedDifficulty === "hard" && hintsUsed === 0
            ? { won: true, levelStarsPatch: { "hard-no-hint": 1 as const } }
            : { won: true };
        const update = updateProgress("sudoku", finalScore, extraOpts);
        setResult(update);
        setPhase("over");
      }
    },
    [phase, selectedCell, clues, solution, elapsedSeconds, hintsUsed, selectedDifficulty, haptic, updateProgress, triggerShake],
  );

  // ── Erase ────────────────────────────────────────────────────────────────
  const handleErase = useCallback(() => {
    if (phase !== "playing" || selectedCell === null) return;
    if (clues[selectedCell] !== 0) return;
    haptic.tap();
    setBoard((prev) => {
      const next = [...prev];
      next[selectedCell] = 0;
      setErrors(computeErrors(next, solution));
      return next;
    });
  }, [phase, selectedCell, clues, solution, haptic]);

  // ── Hint ─────────────────────────────────────────────────────────────────
  const handleHint = useCallback(() => {
    if (phase !== "playing" || hintsLeft <= 0) return;

    const emptyIndices = board
      .map((v, i) => (v === 0 && clues[i] === 0 ? i : -1))
      .filter((i) => i !== -1);

    if (emptyIndices.length === 0) return;

    const target =
      selectedCell !== null &&
      board[selectedCell] === 0 &&
      clues[selectedCell] === 0
        ? selectedCell
        : emptyIndices[0];

    haptic.success();
    setHintsLeft((h) => h - 1);
    setHintsUsed((h) => h + 1);
    setSelectedCell(target);

    const next = [...board];
    next[target] = solution[target];
    setBoard(next);
    setErrors(computeErrors(next, solution));

    const won = isSolved(next, solution);
    if (won && !solvedRef.current) {
      solvedRef.current = true;
      const usedAfter = hintsUsed + 1;
      const finalScore = Math.max(500, 5000 - elapsedSeconds * 8 - usedAfter * 200);
      const update = updateProgress("sudoku", finalScore, { won: true });
      setResult(update);
      setPhase("over");
    }
  }, [
    phase,
    hintsLeft,
    board,
    clues,
    solution,
    selectedCell,
    elapsedSeconds,
    hintsUsed,
    haptic,
    updateProgress,
  ]);

  // ── Border widths for 3×3 box lines ─────────────────────────────────────
  const getCellBorderRight = (idx: number): number => {
    const col = getCol(idx);
    if (col === 8) return 0;
    if (col === 2 || col === 5) return 2;
    return 0.5;
  };

  const getCellBorderBottom = (idx: number): number => {
    const row = getRow(idx);
    if (row === 8) return 0;
    if (row === 2 || row === 5) return 2;
    return 0.5;
  };

  // ── Difficulty helpers ───────────────────────────────────────────────────
  const diffLabel = (d: Difficulty): string => {
    if (d === "easy") return t("sdkEasy");
    if (d === "medium") return t("sdkMedium");
    return t("sdkHard");
  };

  const diffColor = (d: Difficulty): string => {
    if (d === "easy") return theme.successBorder;
    if (d === "medium") return theme.warning;
    return theme.danger;
  };

  // =========================================================================
  // RENDER: Idle
  // =========================================================================

  if (phase === "idle") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.idleTitle, { color: theme.text }]}>
          {t("gameSudokuName")}
        </Text>
        <Text style={[styles.idleDesc, { color: theme.mutedText }]}>
          {t("gameSudokuDescription")}
        </Text>
        <Pressable
          style={[styles.startBtn, { backgroundColor: theme.tint }]}
          onPress={() => {
            haptic.tap();
            setPhase("selecting");
          }}
        >
          <Text style={[styles.startBtnText, { color: theme.onTint }]}>{t("gameTapToStart")}</Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================================
  // RENDER: Difficulty selection
  // =========================================================================

  if (phase === "selecting") {
    const difficulties: Difficulty[] = ["easy", "medium", "hard"];
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.selectTitle, { color: theme.text }]}>
          {t("sdkSelectDifficulty")}
        </Text>
        <RNView style={styles.diffRow}>
          {difficulties.map((d) => (
            <Pressable
              key={d}
              style={[
                styles.diffBtn,
                {
                  backgroundColor: theme.card,
                  borderColor: diffColor(d),
                  borderWidth: 2,
                },
              ]}
              onPress={() => startDifficulty(d)}
              accessibilityRole="button"
              accessibilityLabel={diffLabel(d)}
            >
              <Text style={[styles.diffBtnLabel, { color: diffColor(d) }]}>
                {diffLabel(d)}
              </Text>
              <Text style={[styles.diffBtnSub, { color: theme.mutedText }]}>
                ~
                {t("minutesShort", {
                  minutes: d === "easy" ? 10 : d === "medium" ? 20 : 30,
                })}
              </Text>
            </Pressable>
          ))}
        </RNView>
        <Pressable
          onPress={() => {
            haptic.tap();
            setPhase("idle");
          }}
        >
          <Text style={[styles.backLink, { color: theme.mutedText }]}>
            {t("gameQuit")}
          </Text>
        </Pressable>
      </View>
    );
  }

  // =========================================================================
  // RENDER: Playing / Paused / Over
  // =========================================================================

  const isInteractive = phase === "playing";

  return (
    <View style={[styles.playContainer, { backgroundColor: theme.background }]}>
      {/* ── HUD ── */}
      <RNView style={styles.hudRow}>
        {selectedDifficulty !== null ? (
          <RNView
            style={[
              styles.diffChip,
              {
                backgroundColor: diffColor(selectedDifficulty) + "22",
                borderColor: diffColor(selectedDifficulty),
              },
            ]}
          >
            <Text
              style={[
                styles.diffChipText,
                { color: diffColor(selectedDifficulty) },
              ]}
            >
              {diffLabel(selectedDifficulty)}
            </Text>
          </RNView>
        ) : null}

        <RNView style={styles.hudRight}>
          <RNView
            style={[
              styles.hudStat,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hudStatLabel, { color: theme.mutedText }]}>
              {t("sdkTime")}
            </Text>
            <Text style={[styles.hudStatValue, { color: theme.text }]}>
              {formatTime(elapsedSeconds)}
            </Text>
          </RNView>

          <RNView
            style={[
              styles.hudStat,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hudStatLabel, { color: theme.mutedText }]}>
              {t("sdkHints")}
            </Text>
            <Text style={[styles.hudStatValue, { color: theme.text }]}>
              {hintsLeft}/3
            </Text>
          </RNView>

          <GameControls
            onPause={handlePause}
            onReset={resetToIdle}
            isPaused={phase === "paused"}
          />
        </RNView>
      </RNView>

      {/* ── Grid ── */}
      <Animated.View
        style={[
          styles.grid,
          {
            width: cellSize * 9,
            borderColor: theme.text,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            transform: [{ translateX: gridShake }],
          },
        ]}
      >
        {board.map((value, idx) => {
          const isClue = clues[idx] !== 0;
          const isError = errors.has(idx);
          const isSelected = selectedCell === idx;
          const isPeerCell =
            selectedCell !== null && selectedCell !== idx && isPeer(selectedCell, idx);
          const isMatchingNumber =
            selectedCell !== null &&
            value !== 0 &&
            board[selectedCell] !== 0 &&
            value === board[selectedCell] &&
            idx !== selectedCell;

          let cellBg = theme.background;
          if (isSelected) {
            cellBg = theme.tint + "44";
          } else if (isMatchingNumber) {
            cellBg = theme.tint + "22";
          } else if (isPeerCell) {
            cellBg = theme.surface;
          }

          let textColor = theme.text;
          if (isError) {
            textColor = theme.danger;
          } else if (!isClue && value !== 0) {
            textColor = theme.tint;
          }

          const borderRightWidth = getCellBorderRight(idx);
          const borderBottomWidth = getCellBorderBottom(idx);

          return (
            <AnimatedPressable
              key={idx}
              onPress={() => handleCellPress(idx)}
              disabled={isClue || !isInteractive}
              style={{
                width: cellSize,
                height: cellSize,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cellBg,
                borderRightWidth,
                borderBottomWidth,
                borderRightColor:
                  borderRightWidth === 2 ? theme.text : theme.border,
                borderBottomColor:
                  borderBottomWidth === 2 ? theme.text : theme.border,
                transform: isSelected ? [{ scale: selectPulse }] : undefined,
              }}
            >
              {value !== 0 ? (
                <Text
                  style={{
                    fontSize: cellSize > 38 ? FontSize.md : FontSize.sm,
                    fontWeight: isClue ? FontWeight.black : FontWeight.bold,
                    color: textColor,
                  }}
                >
                  {value}
                </Text>
              ) : null}
            </AnimatedPressable>
          );
        })}
      </Animated.View>

      {/* ── Numpad ── */}
      <RNView style={styles.numpad}>
        {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
          <BouncyPressable
            key={n}
            onPress={() => handleNumberInput(n)}
            disabled={!isInteractive || selectedCell === null}
            style={[
              styles.numBtn,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                opacity: !isInteractive || selectedCell === null ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.numBtnText, { color: theme.text }]}>{n}</Text>
          </BouncyPressable>
        ))}

        {/* Erase button */}
        <BouncyPressable
          onPress={handleErase}
          disabled={!isInteractive || selectedCell === null}
          style={[
            styles.numBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: !isInteractive || selectedCell === null ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[styles.numBtnText, { color: theme.mutedText }]}>✕</Text>
        </BouncyPressable>
      </RNView>

      {/* ── Hint button ── */}
      <Pressable
        onPress={handleHint}
        disabled={!isInteractive || hintsLeft <= 0}
        style={[
          styles.hintBtn,
          {
            backgroundColor: hintsLeft > 0 ? theme.tint + "18" : theme.surface,
            borderColor: hintsLeft > 0 ? theme.tint : theme.border,
            opacity: !isInteractive || hintsLeft <= 0 ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.hintBtnText,
            { color: hintsLeft > 0 ? theme.tint : theme.mutedText },
          ]}
        >
          {t("sdkHints")} ({hintsLeft} {t("sdkHintsLeft")})
        </Text>
      </Pressable>

      {/* ── Pause overlay ── */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={resetToIdle}
      />

      {/* ── Result overlay ── */}
      {phase === "over" && result !== null ? (
        <GameResult
          title={t("sdkCongrats")}
          score={Math.max(500, 5000 - elapsedSeconds * 8 - hintsUsed * 200)}
          best={result.best}
          last={result.last !== Math.max(500, 5000 - elapsedSeconds * 8 - hintsUsed * 200) ? result.last : undefined}
          streak={result.currentStreak > 0 ? result.currentStreak : undefined}
          isNewBest={result.isNewBest}
          onPlayAgain={resetToIdle}
          subtitle={
            selectedDifficulty !== null
              ? `${formatTime(elapsedSeconds)} · ${diffLabel(selectedDifficulty)}`
              : formatTime(elapsedSeconds)
          }
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // ── Idle / Select ──────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
  },
  idleTitle: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.black,
    letterSpacing: 1,
    textAlign: "center",
  },
  idleDesc: {
    fontSize: FontSize.base,
    textAlign: "center",
    lineHeight: FontSize.base * 1.5,
    maxWidth: 280,
  },
  startBtn: {
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
    marginTop: Spacing.sm,
  },
  startBtnText: {
    ...TextStyle.buttonPrimary,
  },
  selectTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  diffRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  diffBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.card,
    gap: Spacing.xs,
    minWidth: 88,
  },
  diffBtnLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
  },
  diffBtnSub: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  backLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },

  // ── Playing ────────────────────────────────────────────────────────────
  playContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  hudRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  hudRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    justifyContent: "flex-end",
  },
  diffChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  diffChipText: {
    ...TextStyle.chipLabel,
    textTransform: "uppercase",
  },
  hudStat: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.card,
    borderWidth: 1,
    minWidth: 56,
  },
  hudStatLabel: {
    ...TextStyle.statLabel,
  },
  hudStatValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  numBtn: {
    width: 40,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  numBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  hintBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.button,
    borderWidth: 1.5,
  },
  hintBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
});
