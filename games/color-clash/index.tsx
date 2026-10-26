import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
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
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

import { buildMatchDeck, clampScore, responseDelta } from "./logic";

// ── Constants ────────────────────────────────────────────────────────────────
const TOTAL_ROUNDS = 20;
const ROUND_MS = 1800;
const FEEDBACK_MS = 350;

// ── Color definitions ─────────────────────────────────────────────────────────
interface ColorEntry {
  hex: string;
  key: TranslationKey;
}

const COLORS: ColorEntry[] = [
  { hex: "#E53935", key: "colorRed" },
  { hex: "#1E88E5", key: "colorBlue" },
  { hex: "#43A047", key: "colorGreen" },
  { hex: "#E6C200", key: "colorYellow" },
  { hex: "#8E24AA", key: "colorPurple" },
  { hex: "#FB8C00", key: "colorOrange" },
];

interface Trial {
  isMatch: boolean;
  textColor: string; // hex ink color
  word: TranslationKey; // color name key
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomColor(): ColorEntry {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateTrial(isMatch: boolean): Trial {
  const wordColor = randomColor();

  if (isMatch) {
    return { isMatch: true, textColor: wordColor.hex, word: wordColor.key };
  }

  // Pick a different color for the ink
  let inkColor = randomColor();
  let attempts = 0;
  while (inkColor.key === wordColor.key && attempts < 10) {
    inkColor = randomColor();
    attempts += 1;
  }
  return { isMatch: false, textColor: inkColor.hex, word: wordColor.key };
}

// ── Phase type ────────────────────────────────────────────────────────────────
type Phase = "idle" | "playing" | "feedback";
type FeedbackKind = "correct" | "wrong" | "miss" | "skip";

type Theme = (typeof Colors)[keyof typeof Colors];

/** Feedback flash: [fill, text on it] from the theme's status tokens. */
function feedbackColors(kind: FeedbackKind, theme: Theme): [string, string] {
  switch (kind) {
    case "wrong":
      return [theme.danger, theme.onDanger];
    case "miss":
      return [theme.warning, theme.onWarning];
    default:
      // "correct" / "skip"
      return [theme.success, theme.onSuccess];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ColorClashGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBestScore = useGameStore(
    (s) => s.progress["color-clash"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [trial, setTrial] = useState<Trial | null>(null);
  const [round, setRound] = useState(0);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  // Animated progress bar (1 → 0 over ROUND_MS)
  const progressAnim = useRef(new Animated.Value(1)).current;
  // Word pop-in on each new round
  const wordAnim = useRef(new Animated.Value(1)).current;
  // Feedback: pulse (scale) on correct, shake (translateX) on wrong/miss
  const feedbackPulseAnim = useRef(new Animated.Value(1)).current;
  const feedbackShakeAnim = useRef(new Animated.Value(0)).current;

  // ── Refs to avoid stale closures ───────────────────────────────────────────
  const roundRef = useRef(0);
  const scoreRef = useRef(0);
  const tappedRef = useRef<boolean>(false);
  const phaseRef = useRef<Phase>("idle");
  const trialRef = useRef<Trial | null>(null);
  // Balanced match/mismatch order for the current game (see logic.ts).
  const deckRef = useRef<boolean[]>(buildMatchDeck(TOTAL_ROUNDS));

  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  // Wall-clock deadlines (Date.now() ms; 0 = not running). The timers only
  // wake the game up — whether the round is over is decided by the clock, so
  // a late tap (JS thread busy, timer not yet fired) can't beat the deadline.
  const roundDeadlineRef = useRef(0);
  const feedbackDeadlineRef = useRef(0);
  // What was running when paused, and how much of it was left.
  const pausedRef = useRef<{
    kind: "round" | "feedback";
    remainingMs: number;
  } | null>(null);
  const [paused, setPaused] = useState(false);

  // Sync phaseRef with state
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

  // ── Cleanup ────────────────────────────────────────────────────────────────
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

  /** Animates the progress bar from its current value down to 0. */
  const runProgress = (ms: number) => {
    const anim = Animated.timing(progressAnim, {
      duration: ms,
      toValue: 0,
      useNativeDriver: false,
    });
    progressAnimRef.current = anim;
    anim.start();
  };

  // ── Feedback flash, then the next round (or the result) ────────────────────
  const finishFeedback = () => {
    feedbackDeadlineRef.current = 0;
    feedbackTimerRef.current = null;
    const nextRound = roundRef.current + 1;
    if (nextRound >= TOTAL_ROUNDS) {
      // Game over
      const finalScoreVal = clampScore(scoreRef.current);
      const info = updateProgress("color-clash", finalScoreVal);
      setProgressInfo(info);
      setFinalScore(finalScoreVal);
      setPhaseSync("idle");
      setTrial(null);
      trialRef.current = null;
      setFeedbackKind(null);
    } else {
      roundRef.current = nextRound;
      setRound(nextRound);
      startRound(nextRound);
    }
  };

  const armFeedbackTimer = () => {
    feedbackTimerRef.current = setTimeout(
      finishFeedback,
      Math.max(0, feedbackDeadlineRef.current - Date.now())
    );
  };

  const showFeedback = (kind: FeedbackKind) => {
    stopTimers();
    roundDeadlineRef.current = 0;
    setPhaseSync("feedback");
    setFeedbackKind(kind);
    feedbackDeadlineRef.current = Date.now() + FEEDBACK_MS;
    armFeedbackTimer();
  };

  // ── Round timeout ──────────────────────────────────────────────────────────
  const timeOutRound = () => {
    const currentTrial = trialRef.current;
    if (phaseRef.current !== "playing" || tappedRef.current || !currentTrial) {
      return;
    }
    tappedRef.current = true;
    // Player didn't tap: +1 on a mismatch, −1 for a missed match.
    scoreRef.current += responseDelta(currentTrial.isMatch, "skip");
    setScoreDisplay(scoreRef.current);
    if (currentTrial.isMatch) {
      showFeedback("miss");
    } else {
      haptic.tap();
      showFeedback("skip");
    }
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

  // ── Start a round ──────────────────────────────────────────────────────────
  // Function declaration (hoisted): finishFeedback above calls it.
  function startRound(roundNum: number) {
    stopTimers();
    feedbackDeadlineRef.current = 0;

    tappedRef.current = false;
    const newTrial = generateTrial(deckRef.current[roundNum] ?? false);
    trialRef.current = newTrial;
    setTrial(newTrial);
    setFeedbackKind(null);
    setPhaseSync("playing");

    // Word pop-in
    wordAnim.setValue(0);
    Animated.spring(wordAnim, {
      bounciness: 8,
      speed: 24,
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Progress bar 1 → 0 over the round; the deadline is the source of truth.
    progressAnim.setValue(1);
    roundDeadlineRef.current = Date.now() + ROUND_MS;
    runProgress(ROUND_MS);
    armRoundTimer();
  }

  // ── Pause / resume ─────────────────────────────────────────────────────────
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

  // ── Feedback flash animation: pulse on correct/skip, shake on wrong/miss ──
  useEffect(() => {
    if (!feedbackKind) {
      return;
    }
    if (feedbackKind === "correct" || feedbackKind === "skip") {
      feedbackPulseAnim.setValue(1);
      Animated.sequence([
        Animated.timing(feedbackPulseAnim, {
          duration: 100,
          toValue: 1.12,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackPulseAnim, {
          duration: 130,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      feedbackShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(feedbackShakeAnim, {
          duration: 50,
          toValue: -8,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackShakeAnim, {
          duration: 60,
          toValue: 8,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackShakeAnim, {
          duration: 50,
          toValue: -4,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackShakeAnim, {
          duration: 40,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [feedbackKind, feedbackPulseAnim, feedbackShakeAnim]);

  // ── Handle player tap ──────────────────────────────────────────────────────
  const handleTap = () => {
    if (phaseRef.current === "idle") {
      // Start the game
      if (finalScore !== null) {
        return; // result overlay shown — ignore
      }
      scoreRef.current = 0;
      roundRef.current = 0;
      deckRef.current = buildMatchDeck(TOTAL_ROUNDS);
      setScoreDisplay(0);
      setRound(0);
      setFinalScore(null);
      setProgressInfo(null);
      startRound(0);
      return;
    }

    if (phaseRef.current !== "playing" || pausedRef.current) {
      return;
    }
    if (tappedRef.current) {
      return;
    }
    if (Date.now() >= roundDeadlineRef.current) {
      // Time was already up (timer not fired yet): it counts as no tap.
      timeOutRound();
      return;
    }
    tappedRef.current = true;

    const currentTrial = trialRef.current;
    if (!currentTrial) {
      return;
    }

    // +1 for tapping a match, −1 for tapping a mismatch.
    // The header shows the true running total (it can dip below 0, so every
    // answer visibly moves it); only the recorded result is floored at 0.
    // Flooring the running total per round would let idling score points
    // whenever the matches happen to come first.
    scoreRef.current += responseDelta(currentTrial.isMatch, "tap");
    setScoreDisplay(scoreRef.current);
    if (currentTrial.isMatch) {
      haptic.success();
      showFeedback("correct");
    } else {
      haptic.error();
      showFeedback("wrong");
    }
  };

  // ── Reset / restart ────────────────────────────────────────────────────────
  const restart = () => {
    stopTimers();
    roundDeadlineRef.current = 0;
    feedbackDeadlineRef.current = 0;
    pausedRef.current = null;
    setPaused(false);
    progressAnim.setValue(1);

    tappedRef.current = false;
    scoreRef.current = 0;
    roundRef.current = 0;
    trialRef.current = null;
    setScoreDisplay(0);
    setRound(0);
    setTrial(null);
    setFeedbackKind(null);
    setFinalScore(null);
    setProgressInfo(null);
    setPhaseSync("idle");
  };

  // ── Derived UI values ──────────────────────────────────────────────────────
  const isIdle = phase === "idle";
  const isPlaying = phase === "playing" || phase === "feedback";

  const feedback = feedbackKind ? feedbackColors(feedbackKind, theme) : null;
  const bgColor = (() => {
    if (feedback) {
      return feedback[0];
    }
    if (isPlaying) {
      return theme.card;
    }
    return theme.elevated;
  })();

  let tapAreaLabel: string | undefined;
  if (isIdle && finalScore === null) {
    tapAreaLabel = t("gameTapToStart");
  } else if (trial) {
    tapAreaLabel = t(trial.word);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <A11yOverlayScope>
      <View style={styles.screen}>
        <A11yOverlayContent style={styles.root}>
          <GameControls
            isPaused={paused}
            onPause={isPlaying && !paused ? pause : undefined}
            onReset={restart}
          />

          {/* Score / round header */}
          {isPlaying ? (
            <View style={styles.header}>
              <Text style={[styles.headerLabel, { color: theme.mutedText }]}>
                {t("colorClashScore")}
              </Text>
              <Text style={[styles.headerScore, { color: theme.text }]}>
                {scoreDisplay}
              </Text>
              <Text style={[styles.headerRound, { color: theme.mutedText }]}>
                {round + 1}/{TOTAL_ROUNDS}
              </Text>
            </View>
          ) : null}

          {/* Progress bar */}
          {isPlaying ? (
            <View
              style={[styles.progressTrack, { backgroundColor: theme.border }]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.tint,
                    flex: progressAnim,
                  },
                ]}
              />
            </View>
          ) : null}

          {/* Main tap area */}
          <Pressable
            accessibilityLabel={tapAreaLabel}
            accessibilityRole="button"
            onPress={handleTap}
            style={[styles.mainArea, { backgroundColor: bgColor }]}
          >
            {isIdle && finalScore === null ? (
              <>
                <Text style={[styles.startText, { color: theme.mutedText }]}>
                  {t("gameTapToStart")}
                </Text>
                <Text style={[styles.hintText, { color: theme.mutedText }]}>
                  {t("colorClashHint")}
                </Text>
              </>
            ) : null}

            {(phase === "playing" || phase === "feedback") && trial ? (
              <Text
                style={[
                  styles.wordText,
                  {
                    color: feedback ? feedback[1] : trial.textColor,
                  },
                ]}
              >
                {t(trial.word)}
              </Text>
            ) : null}
          </Pressable>

          {/* Result overlay */}
        </A11yOverlayContent>
        <GamePauseOverlay
          onRestart={restart}
          onResume={resume}
          visible={paused}
        />
        {finalScore !== null && (
          <GameResult
            best={progressInfo?.best ?? storedBestScore}
            formatScore={(v) => `${v}/${TOTAL_ROUNDS}`}
            isNewBest={progressInfo?.isNewBest}
            last={
              progressInfo?.last === undefined ? undefined : progressInfo.last
            }
            onPlayAgain={restart}
            score={finalScore}
            streak={progressInfo?.currentStreak}
            title={t("gameColorClashName")}
          />
        )}
      </View>
    </A11yOverlayScope>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerRound: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerScore: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  hintText: {
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 32,
    textAlign: "center",
  },
  mainArea: {
    alignItems: "center",
    borderRadius: 24,
    flex: 1,
    justifyContent: "center",
    minHeight: 240,
  },
  progressFill: {
    height: 6,
  },
  progressTrack: {
    borderRadius: 3,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  root: { flex: 1, gap: 12, padding: 20 },
  screen: { flex: 1 },
  startText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  wordText: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
