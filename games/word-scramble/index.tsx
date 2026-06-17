import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Radius, Shadow, Spacing } from "@/constants/Spacing";
import { FontSize, FontWeight, TextStyle } from "@/constants/Typography";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ─── Constants ────────────────────────────────────────────────────────────────

const WORD_POOL = [
  "AIRPORT", "RUNWAY", "CAPTAIN", "BOARDING", "COCKPIT",
  "ALTITUDE", "AIRCRAFT", "HORIZON", "NAVIGATE", "VELOCITY",
  "TAKEOFF", "LANDING", "CUSTOMS", "LUGGAGE", "JOURNEY",
  "COMPASS", "TURBULENCE", "PASSPORT", "TERMINAL", "DEPARTURE",
  "ARRIVAL", "BAGGAGE", "SEATBELT", "WINDOW",
];

const ROUND_COUNT = 12;
const ROUND_SECONDS = 30;
const MAX_SKIPS = 3;
const CORRECT_FLASH_MS = 600;
const TIMER_TICK_MS = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle, returns a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Scramble a word's letters; re-tries until the result differs from the original. */
function scrambleWord(word: string): string[] {
  const letters = word.split("");
  let scrambled = shuffle(letters);
  let attempts = 0;
  while (scrambled.join("") === word && attempts < 20) {
    scrambled = shuffle(letters);
    attempts++;
  }
  return scrambled;
}

/** Pick 12 words randomly from the pool, return them shuffled. */
function pickWords(): string[] {
  return shuffle(WORD_POOL).slice(0, ROUND_COUNT);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "paused" | "correct-flash" | "time-up-flash" | "over";

type LetterTile = {
  /** Position index in the scrambled array (stable key). */
  id: number;
  letter: string;
  used: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WordScrambleGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { t } = useTranslation();
  const haptic = useHaptic();
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["word-scramble"]?.highScore ?? 0,
  );

  // ── Game state ──
  const [phase, setPhase] = useState<Phase>("idle");
  const [words, setWords] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [tiles, setTiles] = useState<LetterTile[]>([]);
  const [answer, setAnswer] = useState<Array<{ tileId: number; letter: string }>>([]);
  const [score, setScore] = useState(0);
  const [skipsRemaining, setSkipsRemaining] = useState(MAX_SKIPS);
  const [timeRemaining, setTimeRemaining] = useState(ROUND_SECONDS);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(null);

  // ── Refs ──
  const timerDeadline = useRef<number>(0);
  const pausedTimeRemaining = useRef<number>(ROUND_SECONDS);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Timer ───────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerInterval.current !== null) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds: number) => {
      stopTimer();
      timerDeadline.current = Date.now() + seconds * 1000;
      timerInterval.current = setInterval(() => {
        const remaining = Math.max(0, (timerDeadline.current - Date.now()) / 1000);
        setTimeRemaining(remaining);
      }, TIMER_TICK_MS);
    },
    [stopTimer],
  );

  // ─── Round setup ─────────────────────────────────────────────────────────────

  const setupRound = useCallback(
    (wordList: string[], index: number) => {
      const word = wordList[index];
      const scrambled = scrambleWord(word);
      const newTiles: LetterTile[] = scrambled.map((letter, i) => ({
        id: i,
        letter,
        used: false,
      }));
      setTiles(newTiles);
      setAnswer([]);
      setPhase("playing");
      startTimer(ROUND_SECONDS);
    },
    [startTimer],
  );

  // ─── Time-up handler ─────────────────────────────────────────────────────────

  const handleTimeUp = useCallback(
    (currentRoundIndex: number, currentWords: string[], currentScore: number, currentSkips: number) => {
      stopTimer();
      haptic.heavy();
      setPhase("time-up-flash");

      setTimeout(() => {
        const nextIndex = currentRoundIndex + 1;
        if (nextIndex >= ROUND_COUNT) {
          const info = updateProgress("word-scramble", currentScore);
          setProgressInfo(info);
          setPhase("over");
        } else {
          setRoundIndex(nextIndex);
          setupRound(currentWords, nextIndex);
        }
      }, 800);
    },
    [haptic, setupRound, stopTimer, updateProgress],
  );

  // ─── Timer effect: watch for time reaching 0 ──────────────────────────────────

  useEffect(() => {
    if (phase !== "playing") return;
    if (timeRemaining <= 0) {
      // Snapshot current state values via refs to avoid stale closures
      handleTimeUp(roundIndex, words, score, skipsRemaining);
    }
  }, [timeRemaining, phase, handleTimeUp, roundIndex, words, score, skipsRemaining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // ─── Start game ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    const newWords = pickWords();
    setWords(newWords);
    setRoundIndex(0);
    setScore(0);
    setSkipsRemaining(MAX_SKIPS);
    setProgressInfo(null);
    setupRound(newWords, 0);
  }, [setupRound]);

  // ─── Tap a scrambled tile ────────────────────────────────────────────────────

  const handleTileTap = useCallback(
    (tileId: number) => {
      if (phase !== "playing") return;

      const tappedTile = tiles.find((t) => t.id === tileId);
      if (!tappedTile || tappedTile.used) return;

      haptic.tap();

      const newAnswer = [...answer, { tileId, letter: tappedTile.letter }];
      const newTiles = tiles.map((t) =>
        t.id === tileId ? { ...t, used: true } : t,
      );

      const currentWord = words[roundIndex];

      if (newAnswer.length === currentWord.length) {
        // All letters placed — check correctness
        const formed = newAnswer.map((a) => a.letter).join("");
        if (formed === currentWord) {
          // Correct!
          stopTimer();
          haptic.success();
          const bonus = Math.min(5, Math.floor(timeRemaining / 6));
          const gained = 10 + bonus;
          const nextScore = score + gained;

          setAnswer(newAnswer);
          setTiles(newTiles);
          setScore(nextScore);
          setPhase("correct-flash");

          setTimeout(() => {
            const nextIndex = roundIndex + 1;
            if (nextIndex >= ROUND_COUNT) {
              const info = updateProgress("word-scramble", nextScore);
              setProgressInfo(info);
              setPhase("over");
            } else {
              setRoundIndex(nextIndex);
              setupRound(words, nextIndex);
            }
          }, CORRECT_FLASH_MS);
        } else {
          // Wrong permutation (shouldn't normally happen with correct word-tap logic,
          // but handle gracefully: reset answer and re-enable tiles)
          haptic.error();
          setAnswer([]);
          setTiles(tiles.map((t) => ({ ...t, used: false })));
        }
      } else {
        setAnswer(newAnswer);
        setTiles(newTiles);
      }
    },
    [
      phase, tiles, answer, words, roundIndex,
      score, timeRemaining,
      haptic, stopTimer, setupRound, updateProgress,
    ],
  );

  // ─── Backspace ───────────────────────────────────────────────────────────────

  const handleBackspace = useCallback(() => {
    if (phase !== "playing" || answer.length === 0) return;

    haptic.tap();
    const last = answer[answer.length - 1];
    const newAnswer = answer.slice(0, -1);
    const newTiles = tiles.map((t) =>
      t.id === last.tileId ? { ...t, used: false } : t,
    );
    setAnswer(newAnswer);
    setTiles(newTiles);
  }, [phase, answer, tiles, haptic]);

  // ─── Skip ────────────────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    if (phase !== "playing" || skipsRemaining <= 0) return;

    haptic.tap();
    stopTimer();
    const nextSkips = skipsRemaining - 1;
    setSkipsRemaining(nextSkips);

    const nextIndex = roundIndex + 1;
    if (nextIndex >= ROUND_COUNT) {
      const info = updateProgress("word-scramble", score);
      setProgressInfo(info);
      setPhase("over");
    } else {
      setRoundIndex(nextIndex);
      setupRound(words, nextIndex);
    }
  }, [
    phase, skipsRemaining, roundIndex, words, score,
    haptic, stopTimer, setupRound, updateProgress,
  ]);

  // ─── Pause / Resume ──────────────────────────────────────────────────────────

  const handlePause = useCallback(() => {
    if (phase !== "playing") return;
    stopTimer();
    pausedTimeRemaining.current = Math.max(0, (timerDeadline.current - Date.now()) / 1000);
    setPhase("paused");
  }, [phase, stopTimer]);

  const handleResume = useCallback(() => {
    if (phase !== "paused") return;
    startTimer(pausedTimeRemaining.current);
    setPhase("playing");
  }, [phase, startTimer]);

  // ─── Restart ─────────────────────────────────────────────────────────────────

  const handleRestart = useCallback(() => {
    stopTimer();
    startGame();
  }, [stopTimer, startGame]);

  // ─── Derived values ──────────────────────────────────────────────────────────

  const currentWord = words[roundIndex] ?? "";
  const timerProgress = timeRemaining / ROUND_SECONDS; // 1.0 → 0.0
  const timerColor =
    timeRemaining > 15
      ? theme.tint
      : timeRemaining > 8
        ? theme.warning
        : "#ef4444";

  const isCorrectFlash = phase === "correct-flash";
  const isTimeUpFlash = phase === "time-up-flash";

  // ─── Idle screen ─────────────────────────────────────────────────────────────

  if (phase === "idle") {
    return (
      <View style={styles.root}>
        <View style={styles.idleContainer}>
          <Text style={[styles.idleTitle, { color: theme.text }]}>
            {t("gameWordScrambleName")}
          </Text>
          <Text style={[styles.idleSubtitle, { color: theme.mutedText }]}>
            {t("wsTapLetters")}
          </Text>
          <Pressable
            style={[styles.startButton, { backgroundColor: theme.tint }]}
            onPress={startGame}
          >
            <Text style={styles.startButtonText}>{t("gameTapToStart")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── Over screen ─────────────────────────────────────────────────────────────

  if (phase === "over") {
    return (
      <View style={styles.root}>
        <GameResult
          title={t("wsWellDone")}
          score={score}
          best={progressInfo?.best ?? storedBest}
          last={progressInfo?.previousBest}
          streak={progressInfo?.currentStreak}
          isNewBest={progressInfo?.isNewBest ?? false}
          onPlayAgain={handleRestart}
        />
      </View>
    );
  }

  // ─── Playing / Paused / Flash screens ────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header row */}
      <RNView style={styles.headerRow}>
        <RNView style={styles.headerStats}>
          {/* Round indicator */}
          <RNView style={[styles.statPill, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("wsRound")}
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {roundIndex + 1}
              <Text style={[styles.statTotal, { color: theme.mutedText }]}>
                /{ROUND_COUNT}
              </Text>
            </Text>
          </RNView>
          {/* Score */}
          <RNView style={[styles.statPill, { backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>
              {t("gameBest").toUpperCase()}
            </Text>
            <Text style={[styles.statValue, { color: theme.tint }]}>
              {score}
            </Text>
          </RNView>
        </RNView>

        <GameControls
          onPause={phase === "playing" ? handlePause : undefined}
          onReset={handleRestart}
          isPaused={phase === "paused"}
        />
      </RNView>

      {/* Timer bar */}
      <RNView style={[styles.timerTrack, { backgroundColor: theme.progressTrack }]}>
        <RNView
          style={[
            styles.timerFill,
            {
              backgroundColor: timerColor,
              width: `${Math.round(timerProgress * 100)}%` as `${number}%`,
            },
          ]}
        />
      </RNView>

      {/* Timer seconds */}
      <Text style={[styles.timerText, { color: timerColor }]}>
        {Math.ceil(timeRemaining)}s
      </Text>

      {/* Flash feedback */}
      {(isCorrectFlash || isTimeUpFlash) && (
        <RNView
          style={[
            styles.flashBanner,
            {
              backgroundColor: isCorrectFlash
                ? theme.successSurface
                : "#4d1f1f",
              borderColor: isCorrectFlash
                ? theme.successBorder
                : "#cc4b4b",
            },
          ]}
        >
          <Text
            style={[
              styles.flashText,
              {
                color: isCorrectFlash ? theme.successBorder : "#ef4444",
              },
            ]}
          >
            {isCorrectFlash ? t("wsCorrect") : t("wsTimeUp")}
          </Text>
        </RNView>
      )}

      {/* Hint text */}
      {phase === "playing" && (
        <Text style={[styles.hintText, { color: theme.mutedText }]}>
          {t("wsTapLetters")}
        </Text>
      )}

      {/* Scrambled letter tiles */}
      <RNView style={styles.tilesContainer}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.id}
            onPress={() => handleTileTap(tile.id)}
            disabled={tile.used || phase !== "playing"}
            style={[
              styles.tile,
              {
                backgroundColor: tile.used ? theme.surface : theme.tint,
                borderColor: tile.used ? theme.border : theme.tint,
                opacity: tile.used ? 0.3 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.tileLetter,
                { color: tile.used ? theme.mutedText : "#ffffff" },
              ]}
            >
              {tile.letter}
            </Text>
          </Pressable>
        ))}
      </RNView>

      {/* Answer boxes */}
      <RNView style={styles.answerContainer}>
        {currentWord.split("").map((_, i) => {
          const filled = answer[i];
          return (
            <RNView
              key={i}
              style={[
                styles.answerBox,
                {
                  backgroundColor: filled
                    ? isCorrectFlash
                      ? theme.successSurface
                      : theme.elevated
                    : theme.surface,
                  borderColor: filled
                    ? isCorrectFlash
                      ? theme.successBorder
                      : theme.tint
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.answerLetter,
                  {
                    color: filled
                      ? isCorrectFlash
                        ? theme.successBorder
                        : theme.text
                      : theme.border,
                  },
                ]}
              >
                {filled ? filled.letter : "_"}
              </Text>
            </RNView>
          );
        })}
      </RNView>

      {/* Action buttons: Backspace + Skip */}
      <RNView style={styles.actionsRow}>
        <Pressable
          onPress={handleBackspace}
          disabled={phase !== "playing" || answer.length === 0}
          style={[
            styles.actionBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: phase !== "playing" || answer.length === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: theme.text }]}>
            ⌫
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          disabled={phase !== "playing" || skipsRemaining <= 0}
          style={[
            styles.actionBtn,
            styles.skipBtn,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              opacity: phase !== "playing" || skipsRemaining <= 0 ? 0.4 : 1,
            },
          ]}
        >
          <Text style={[styles.actionBtnText, { color: theme.mutedText }]}>
            {t("wsSkip")}
          </Text>
          <Text style={[styles.skipCount, { color: theme.tint }]}>
            {skipsRemaining}
          </Text>
        </Pressable>
      </RNView>

      {/* Skips remaining label */}
      <Text style={[styles.skipsLabel, { color: theme.mutedText }]}>
        {t("wsSkipsLeft", { n: skipsRemaining })}
      </Text>

      {/* Pause overlay */}
      <GamePauseOverlay
        visible={phase === "paused"}
        onResume={handleResume}
        onRestart={handleRestart}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // ── Idle ──
  idleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  idleTitle: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.black,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  idleSubtitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    textAlign: "center",
  },
  startButton: {
    paddingHorizontal: Spacing["4xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Radius.button,
    marginTop: Spacing.md,
    ...Shadow.card,
  },
  startButtonText: {
    color: "#ffffff",
    ...TextStyle.buttonPrimary,
  },

  // ── Header ──
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerStats: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.pill,
  },
  statLabel: {
    ...TextStyle.statLabel,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
  },
  statTotal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // ── Timer ──
  timerTrack: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  timerText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: "right",
    marginTop: -Spacing.xs,
  },

  // ── Flash ──
  flashBanner: {
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  flashText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
    letterSpacing: 1,
  },

  // ── Hint ──
  hintText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: "center",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // ── Scrambled tiles ──
  tilesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.card,
  },
  tileLetter: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
  },

  // ── Answer boxes ──
  answerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  answerBox: {
    width: 36,
    height: 42,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  answerLetter: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },

  // ── Action buttons ──
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.button,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  skipBtn: {
    paddingHorizontal: Spacing["2xl"],
  },
  actionBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  skipCount: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.black,
  },
  skipsLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
