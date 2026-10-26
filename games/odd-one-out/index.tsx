import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View as RNView, StyleSheet } from "react-native";
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
import { useAutoPause } from "@/hooks/useAutoPause";
import { useGameDimensions } from "@/hooks/useGameDimensions";
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
  const { width } = useGameDimensions();

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
  // Wall-clock deadlines (Date.now() ms; 0 = not running). Timers only wake
  // the game up; the clock decides, so a late tap can't beat the deadline.
  const roundDeadlineRef = useRef(0);
  const feedbackDeadlineRef = useRef(0);
  // What was running when paused, and how much of it was left.
  const pausedRef = useRef<{
    kind: "round" | "feedback";
    remainingMs: number;
  } | null>(null);
  const [paused, setPaused] = useState(false);

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopTimers = () => {
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    }
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    // stop() leaves the bar where it is — resume continues from there.
    progressAnimRef.current?.stop();
  };

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

  /** Animates the time bar from its current value down to 0. */
  const runProgress = (ms: number) => {
    const anim = Animated.timing(progressAnim, {
      duration: ms,
      toValue: 0,
      useNativeDriver: false,
    });
    progressAnimRef.current = anim;
    anim.start();
  };

  // ── After the feedback flash, advance ─────────────────────────────────────
  const advanceAfterFeedback = () => {
    feedbackDeadlineRef.current = 0;
    feedbackTimerRef.current = null;
    const nextRound = roundRef.current + 1;
    if (nextRound > TOTAL_ROUNDS) {
      // Game over
      const currentScore = scoreRef.current;
      const info = updateProgress("odd-one-out", currentScore);
      setProgressInfo(info);
      setFinalScore(currentScore);
      setPhaseSync("idle");
      setRoundData(null);
      setFeedbackIndex(null);
      setFeedbackKind(null);
    } else {
      startRound(nextRound);
    }
  };

  const armFeedbackTimer = () => {
    feedbackTimerRef.current = setTimeout(
      advanceAfterFeedback,
      Math.max(0, feedbackDeadlineRef.current - Date.now())
    );
  };

  const beginFeedback = () => {
    stopTimers();
    roundDeadlineRef.current = 0;
    setPhaseSync("feedback");
    feedbackDeadlineRef.current = Date.now() + FEEDBACK_MS;
    armFeedbackTimer();
  };

  // ── Round timeout ─────────────────────────────────────────────────────────
  const timeOutRound = () => {
    if (phaseRef.current !== "playing") {
      return;
    }
    haptic.error();
    setFeedbackKind("timeout");
    beginFeedback();
  };

  const armRoundTimer = () => {
    roundTimerRef.current = setTimeout(
      () => {
        if (Date.now() < roundDeadlineRef.current) {
          armRoundTimer(); // woke up early — wait for the real deadline
          return;
        }
        timeOutRound();
      },
      Math.max(0, roundDeadlineRef.current - Date.now())
    );
  };

  // ── Start a round ─────────────────────────────────────────────────────────
  // Function declaration (hoisted): advanceAfterFeedback above calls it.
  function startRound(roundNum: number) {
    stopTimers();
    feedbackDeadlineRef.current = 0;

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

    // Time bar 1 → 0 over the round; the deadline is the source of truth.
    const roundMs = getRoundMs(roundNum);
    progressAnim.setValue(1);
    roundDeadlineRef.current = Date.now() + roundMs;
    runProgress(roundMs);
    armRoundTimer();
  }

  // ── Pause / resume ────────────────────────────────────────────────────────
  const pause = () => {
    if (pausedRef.current) {
      return; // already paused (e.g. inactive → background)
    }
    const now = Date.now();
    if (phaseRef.current === "playing" && roundDeadlineRef.current > 0) {
      pausedRef.current = {
        kind: "round",
        remainingMs: Math.max(0, roundDeadlineRef.current - now),
      };
    } else if (
      phaseRef.current === "feedback" &&
      feedbackDeadlineRef.current > 0
    ) {
      pausedRef.current = {
        kind: "feedback",
        remainingMs: Math.max(0, feedbackDeadlineRef.current - now),
      };
    } else {
      return;
    }
    stopTimers();
    setPaused(true);
  };

  const resume = () => {
    const saved = pausedRef.current;
    if (!saved) {
      return;
    }
    pausedRef.current = null;
    setPaused(false);
    const until = Date.now() + saved.remainingMs;
    if (saved.kind === "round") {
      roundDeadlineRef.current = until;
      runProgress(saved.remainingMs);
      armRoundTimer();
    } else {
      feedbackDeadlineRef.current = until;
      armFeedbackTimer();
    }
  };

  // Leaving the app (home, call, lock) pauses; the player resumes by hand.
  useAutoPause(pause, (phase === "playing" || phase === "feedback") && !paused);

  // ── Handle cell tap ───────────────────────────────────────────────────────
  const handleCellTap = (index: number) => {
    if (phaseRef.current !== "playing" || pausedRef.current) {
      return;
    }
    if (!roundData) {
      return;
    }
    if (Date.now() >= roundDeadlineRef.current) {
      // Time was already up (timer not fired yet): too late to count.
      timeOutRound();
      return;
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

    beginFeedback();
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
    startRound(1);
  };

  // ── Restart ───────────────────────────────────────────────────────────────
  const restart = () => {
    stopTimers();
    roundDeadlineRef.current = 0;
    feedbackDeadlineRef.current = 0;
    pausedRef.current = null;
    setPaused(false);
    progressAnim.setValue(1);
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
    <A11yOverlayScope>
      <View style={styles.screen}>
        <A11yOverlayContent style={styles.root}>
          {/* ── Header controls ── */}
          <RNView style={styles.headerRow}>
            <RNView style={[styles.scorePill, { backgroundColor: theme.card }]}>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                {t("oddScore")}
              </Text>
              <Text style={[styles.statValue, { color: theme.tint }]}>
                {score}
              </Text>
            </RNView>
            <RNView style={[styles.roundPill, { backgroundColor: theme.card }]}>
              <Text style={[styles.statLabel, { color: theme.mutedText }]}>
                {t("oddRound")}
              </Text>
              <Text style={[styles.statValue, { color: theme.text }]}>
                {round > 0 ? `${round}/${TOTAL_ROUNDS}` : `—/${TOTAL_ROUNDS}`}
              </Text>
            </RNView>
            <GameControls
              isPaused={paused}
              onPause={phase === "idle" || paused ? undefined : pause}
              onReset={phase === "idle" ? undefined : restart}
            />
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
                    <RNView
                      key={row}
                      style={[styles.gridRow, { gap: CELL_GAP }]}
                    >
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
        </A11yOverlayContent>
        <GamePauseOverlay
          onRestart={restart}
          onResume={resume}
          visible={paused}
        />
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
    </A11yOverlayScope>
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
  screen: { flex: 1 },
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
