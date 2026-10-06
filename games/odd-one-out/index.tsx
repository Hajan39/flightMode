import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  View as RNView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ── Constants ─────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 15;
const FEEDBACK_MS = 300;
const INITIAL_ROUND_MS = 6000;
const ROUND_MS_DECREMENT = 200;
const MIN_ROUND_MS = 3000;

// ── Emoji groups ──────────────────────────────────────────────────────────────
interface EmojiGroup {
  main: string;
  odd: string;
}

const EMOJI_GROUPS: EmojiGroup[] = [
  { main: "🍎", odd: "🍊" },
  { main: "🐶", odd: "🐱" },
  { main: "⭐", odd: "🌙" },
  { main: "🚗", odd: "🚕" },
  { main: "🏠", odd: "🏡" },
  { main: "❤️", odd: "🧡" },
  { main: "✈️", odd: "🚀" },
  { main: "🌊", odd: "🌋" },
  { main: "🎵", odd: "🎸" },
  { main: "🍕", odd: "🍔" },
];

// ── Grid config ───────────────────────────────────────────────────────────────
interface GridConfig {
  cols: number;
  rows: number;
}

function getGridConfig(round: number): GridConfig {
  if (round <= 5) {
    return { cols: 3, rows: 3 };
  }
  if (round <= 10) {
    return { cols: 4, rows: 4 };
  }
  return { cols: 5, rows: 4 };
}

function getRoundMs(round: number): number {
  return Math.max(
    MIN_ROUND_MS,
    INITIAL_ROUND_MS - (round - 1) * ROUND_MS_DECREMENT
  );
}

// ── Game round data ───────────────────────────────────────────────────────────
interface RoundData {
  cols: number;
  grid: string[];
  oddIndex: number;
  rows: number;
}

function generateRound(round: number): RoundData {
  const { cols, rows } = getGridConfig(round);
  const total = cols * rows;
  const group = EMOJI_GROUPS[Math.floor(Math.random() * EMOJI_GROUPS.length)];
  const oddIndex = Math.floor(Math.random() * total);
  const grid = Array.from({ length: total }, (_, i) =>
    i === oddIndex ? group.odd : group.main
  );
  return { cols, grid, oddIndex, rows };
}

// ── Phase ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "playing" | "feedback";
type FeedbackKind = "correct" | "wrong" | "timeout";

export default function OddOneOutGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["odd-one-out"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { width } = useWindowDimensions();

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  // Animated progress bar (1 → 0)
  const progressAnim = useRef(new Animated.Value(1)).current;
  // Grid entrance (fade/scale-in as one container — cheap for up to 20 cells)
  const gridAnim = useRef(new Animated.Value(1)).current;
  // Tapped-cell feedback: pulse (scale) + shake (translateX)
  const cellPulseAnim = useRef(new Animated.Value(1)).current;
  const cellShakeAnim = useRef(new Animated.Value(0)).current;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const phaseRef = useRef<Phase>("idle");
  const roundRef = useRef(0);
  const scoreRef = useRef(0);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const setPhaseSync = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(
    () => () => {
      if (roundTimerRef.current) {
        clearTimeout(roundTimerRef.current);
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      if (progressAnimRef.current) {
        progressAnimRef.current.stop();
      }
    },
    []
  );

  // ── After feedback flash, advance ─────────────────────────────────────────
  // startRoundByNum is declared below and is stable; deliberately omitted
  // from the deps to break the callback cycle (adding it is a TDZ error).
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional omission, see comment
  const advanceAfterFeedback = useCallback(
    (nextRound: number, currentScore: number) => {
      if (nextRound > TOTAL_ROUNDS) {
        // Game over
        const info = updateProgress("odd-one-out", currentScore);
        setProgressInfo(info);
        setFinalScore(currentScore);
        setPhaseSync("idle");
        setRoundData(null);
        setFeedbackIndex(null);
        setFeedbackKind(null);
      } else {
        startRoundByNum(nextRound);
      }
    },
    // startRoundByNum is declared below and is stable; it's deliberately
    // omitted from the deps to break the circular reference between the
    // two callbacks (adding it is a TDZ error — it doesn't exist yet here).
    [setPhaseSync, updateProgress]
  );

  // ── Start a round ─────────────────────────────────────────────────────────
  const startRoundByNum = useCallback(
    (roundNum: number) => {
      if (roundTimerRef.current) {
        clearTimeout(roundTimerRef.current);
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
      if (progressAnimRef.current) {
        progressAnimRef.current.stop();
      }

      roundRef.current = roundNum;
      setRound(roundNum);
      setFeedbackIndex(null);
      setFeedbackKind(null);

      const data = generateRound(roundNum);
      setRoundData(data);
      setPhaseSync("playing");

      // New-round grid entrance (single container animation)
      gridAnim.setValue(0);
      Animated.spring(gridAnim, {
        bounciness: 6,
        speed: 24,
        toValue: 1,
        useNativeDriver: true,
      }).start();

      // Animate progress bar 1 → 0 over round duration
      const roundMs = getRoundMs(roundNum);
      progressAnim.setValue(1);
      const anim = Animated.timing(progressAnim, {
        duration: roundMs,
        toValue: 0,
        useNativeDriver: false,
      });
      progressAnimRef.current = anim;
      anim.start();

      // Deadline-based timeout using wall-clock
      const deadline = Date.now() + roundMs;
      roundTimerRef.current = setTimeout(
        () => {
          if (phaseRef.current !== "playing") {
            return;
          }
          // timeout
          haptic.error();
          setFeedbackKind("timeout");
          setPhaseSync("feedback");

          const nextRound = roundRef.current + 1;
          feedbackTimerRef.current = setTimeout(() => {
            advanceAfterFeedback(nextRound, scoreRef.current);
          }, FEEDBACK_MS);
        },
        Math.max(0, deadline - Date.now())
      );
    },
    [haptic, progressAnim, gridAnim, setPhaseSync, advanceAfterFeedback]
  );

  // ── Handle cell tap ───────────────────────────────────────────────────────
  const handleCellTap = (index: number) => {
    if (phaseRef.current !== "playing") {
      return;
    }
    if (!roundData) {
      return;
    }

    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
    }
    if (progressAnimRef.current) {
      progressAnimRef.current.stop();
    }

    const isCorrect = index === roundData.oddIndex;
    setFeedbackIndex(index);

    if (isCorrect) {
      haptic.success();
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFeedbackKind("correct");
      // Correct cell pulse
      cellPulseAnim.setValue(1);
      Animated.sequence([
        Animated.timing(cellPulseAnim, {
          duration: 110,
          toValue: 1.18,
          useNativeDriver: true,
        }),
        Animated.timing(cellPulseAnim, {
          duration: 130,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      haptic.error();
      setFeedbackKind("wrong");
      // Wrong cell shake
      cellShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(cellShakeAnim, {
          duration: 50,
          toValue: -6,
          useNativeDriver: true,
        }),
        Animated.timing(cellShakeAnim, {
          duration: 60,
          toValue: 6,
          useNativeDriver: true,
        }),
        Animated.timing(cellShakeAnim, {
          duration: 50,
          toValue: -3,
          useNativeDriver: true,
        }),
        Animated.timing(cellShakeAnim, {
          duration: 40,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }

    setPhaseSync("feedback");

    const nextRound = roundRef.current + 1;
    feedbackTimerRef.current = setTimeout(() => {
      advanceAfterFeedback(nextRound, scoreRef.current);
    }, FEEDBACK_MS);
  };

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = () => {
    if (phaseRef.current !== "idle") {
      return;
    }
    scoreRef.current = 0;
    roundRef.current = 0;
    setScore(0);
    setRound(0);
    setFinalScore(null);
    setProgressInfo(null);
    startRoundByNum(1);
  };

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = () => {
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    if (progressAnimRef.current) {
      progressAnimRef.current.stop();
    }
    scoreRef.current = 0;
    roundRef.current = 0;
    setPhaseSync("idle");
    setScore(0);
    setRound(0);
    setRoundData(null);
    setFeedbackIndex(null);
    setFeedbackKind(null);
    setFinalScore(null);
    setProgressInfo(null);
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  const cols = roundData?.cols ?? 3;
  const rows = roundData?.rows ?? 3;
  const GRID_PADDING = 20;
  const CELL_GAP = 8;
  const gridWidth = width - GRID_PADDING * 2;
  const cellSize = Math.floor((gridWidth - CELL_GAP * (cols - 1)) / cols);
  let emojiFontSize = 22;
  if (cols <= 3) {
    emojiFontSize = 32;
  } else if (cols <= 4) {
    emojiFontSize = 26;
  }

  const isIdle = phase === "idle";
  const isPlaying = phase === "playing";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* ── Header controls ── */}
      <RNView style={styles.headerRow}>
        <RNView style={[styles.scorePill, { backgroundColor: theme.card }]}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("oddScore")}
          </Text>
          <Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
        </RNView>
        <RNView style={[styles.roundPill, { backgroundColor: theme.card }]}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("oddRound")}
          </Text>
          <Text style={[styles.statValue, { color: theme.text }]}>
            {round > 0 ? `${round}/${TOTAL_ROUNDS}` : `—/${TOTAL_ROUNDS}`}
          </Text>
        </RNView>
        <GameControls onReset={phase === "idle" ? undefined : restart} />
      </RNView>

      {/* ── Time bar ── */}
      <RNView style={[styles.timeTrack, { backgroundColor: theme.card }]}>
        <Animated.View
          style={[
            styles.timeFill,
            {
              backgroundColor: theme.tint,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </RNView>

      {/* ── Grid or idle prompt ── */}
      {isIdle && finalScore === null ? (
        <Pressable
          accessibilityLabel={t("gameTapToStart")}
          accessibilityRole="button"
          onPress={startGame}
          style={[
            styles.idleArea,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.idleTitle, { color: theme.text }]}>
            {t("gameTapToStart")}
          </Text>
          <Text style={[styles.idleHint, { color: theme.mutedText }]}>
            {t("oddFind")}
          </Text>
        </Pressable>
      ) : (
        <RNView style={styles.gridWrapper}>
          {roundData ? (
            <Animated.View
              style={[
                styles.gridContainer,
                {
                  gap: CELL_GAP,
                  opacity: gridAnim,
                  transform: [
                    {
                      scale: gridAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {Array.from({ length: rows }, (_, row) => (
                <RNView key={row} style={[styles.gridRow, { gap: CELL_GAP }]}>
                  {Array.from({ length: cols }, (_unused, col) => {
                    const index = row * cols + col;
                    const emoji = roundData.grid[index];
                    const isTapped = feedbackIndex === index;
                    const isOdd = roundData.oddIndex === index;

                    // Cell background based on feedback state
                    let cellBg = theme.elevated;
                    let cellBorder = theme.border;

                    if (phase === "feedback") {
                      if (isTapped && feedbackKind === "correct") {
                        cellBg = theme.successSurface;
                        cellBorder = theme.successBorder;
                      } else if (isTapped && feedbackKind === "wrong") {
                        cellBg = theme.dangerSurface;
                        cellBorder = theme.dangerBorder;
                      } else if (feedbackKind === "timeout" && isOdd) {
                        cellBg = theme.dangerSurface;
                        cellBorder = theme.dangerBorder;
                      }
                    }

                    return (
                      <Pressable
                        key={index}
                        onPress={() => handleCellTap(index)}
                        style={[
                          styles.cell,
                          {
                            backgroundColor: cellBg,
                            borderColor: cellBorder,
                            height: cellSize,
                            width: cellSize,
                          },
                        ]}
                      >
                        <Animated.Text
                          style={[
                            styles.cellEmoji,
                            { fontSize: emojiFontSize },
                            isTapped
                              ? {
                                  transform: [
                                    { scale: cellPulseAnim },
                                    { translateX: cellShakeAnim },
                                  ],
                                }
                              : null,
                          ]}
                        >
                          {emoji}
                        </Animated.Text>
                      </Pressable>
                    );
                  })}
                </RNView>
              ))}
            </Animated.View>
          ) : null}
          {phase === "feedback" && feedbackKind === "timeout" && (
            <RNView
              style={[
                styles.timeoutBanner,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.dangerBorder,
                },
              ]}
            >
              <Text style={[styles.timeoutText, { color: theme.danger }]}>
                {t("oddTimeUp")}
              </Text>
            </RNView>
          )}
        </RNView>
      )}

      {/* ── Hint label when playing ── */}
      {isPlaying && (
        <Text style={[styles.hintText, { color: theme.mutedText }]}>
          {t("oddFind")}
        </Text>
      )}

      {/* ── Game result overlay ── */}
      {finalScore !== null && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={finalScore}
          streak={progressInfo?.currentStreak}
          subtitle={`${finalScore} / ${TOTAL_ROUNDS}`}
          title={t("gameOddOneOutName")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  cellEmoji: {
    textAlign: "center",
  },
  gridContainer: {
    alignItems: "center",
  },
  gridRow: {
    flexDirection: "row",
  },
  /* ── Grid ── */
  gridWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  /* ── Header ── */
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  /* ── Playing hint ── */
  hintText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  /* ── Idle ── */
  idleArea: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1.5,
    flex: 1,
    gap: 12,
    justifyContent: "center",
    minHeight: 220,
  },
  idleHint: {
    fontSize: 15,
    fontWeight: "600",
  },
  idleTitle: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  root: { flex: 1, gap: 12, padding: 20 },
  roundPill: {
    alignItems: "baseline",
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scorePill: {
    alignItems: "baseline",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statValue: { fontSize: 16, fontWeight: "900" },
  timeFill: {
    borderRadius: 999,
    height: "100%",
  },
  /* ── Timeout banner ── */
  timeoutBanner: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  timeoutText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  /* ── Time bar ── */
  timeTrack: {
    borderRadius: 999,
    height: 6,
    overflow: "hidden",
  },
});
