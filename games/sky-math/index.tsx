import { useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

interface Question {
  answer: number;
  options: number[];
  text: string;
}

type SkyMathDifficulty = "easy" | "medium" | "hard";

const TOTAL_QUESTIONS = 12;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Progressive difficulty based on question index (0-based):
 * 0-3: simple add/sub with small numbers
 * 4-7: larger numbers, occasional multiply
 * 8-11: multiply/divide, bigger ranges, tighter decoys
 */
function createQuestion(
  questionIndex = 0,
  difficulty: SkyMathDifficulty = "medium"
): Question {
  const difficultyOffset =
    difficulty === "easy" ? -1 : difficulty === "hard" ? 1 : 0;
  const phase = Math.max(
    0,
    Math.min(2, Math.floor(questionIndex / 4) + difficultyOffset)
  );

  let a: number, b: number, answer: number, text: string;
  const decoySpread = Math.max(3, 9 - phase * 2);

  if (phase <= 0) {
    // Easy: add/subtract small numbers
    a = randomInt(3, 30);
    b = randomInt(2, 20);
    const usePlus = Math.random() > 0.45;
    answer = usePlus ? a + b : a - b;
    text = usePlus ? `${a} + ${b}` : `${a} − ${b}`;
  } else if (phase === 1) {
    // Medium: bigger numbers or simple multiply
    const op = Math.random();
    if (op < 0.35) {
      // multiply
      a = randomInt(2, 12);
      b = randomInt(2, 9);
      answer = a * b;
      text = `${a} × ${b}`;
    } else if (op < 0.65) {
      // add with bigger numbers
      a = randomInt(15, 80);
      b = randomInt(10, 50);
      answer = a + b;
      text = `${a} + ${b}`;
    } else {
      // subtract bigger
      a = randomInt(30, 99);
      b = randomInt(10, a - 1);
      answer = a - b;
      text = `${a} − ${b}`;
    }
  } else {
    // Hard: multiply/divide, large ranges
    const op = Math.random();
    if (op < 0.4) {
      // multiply larger
      a = randomInt(4, 15);
      b = randomInt(3, 12);
      answer = a * b;
      text = `${a} × ${b}`;
    } else if (op < 0.7) {
      // divide (always clean)
      b = randomInt(2, 12);
      answer = randomInt(2, 15);
      a = b * answer;
      text = `${a} ÷ ${b}`;
    } else {
      // big add/sub
      a = randomInt(50, 200);
      b = randomInt(20, 100);
      const usePlus = Math.random() > 0.5;
      answer = usePlus ? a + b : a - b;
      text = usePlus ? `${a} + ${b}` : `${a} − ${b}`;
    }
  }

  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const noise = randomInt(-decoySpread, decoySpread);
    if (noise !== 0) {
      options.add(answer + noise);
    }
  }

  return {
    answer,
    options: Array.from(options).sort(() => Math.random() - 0.5),
    text,
  };
}

export default function SkyMathGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["sky-math"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<SkyMathDifficulty>("medium");
  const [question, setQuestion] = useState<Question>(() =>
    createQuestion(0, "medium")
  );
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  const progressLabel = `${index + 1} / ${TOTAL_QUESTIONS}`;
  const progressFraction = (index + 1) / TOTAL_QUESTIONS;

  // Synchronous re-entry guard: `selectedOption` state does not flush between
  // two near-simultaneous taps, so a ref prevents double-advance / a double
  // updateProgress on the final question.
  const answeringRef = useRef(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    },
    []
  );

  const restart = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
    }
    answeringRef.current = false;
    setIndex(0);
    setScore(0);
    setSelectedOption(null);
    setQuestion(createQuestion(0, difficulty));
    setShowResult(false);
    setIsPaused(false);
    setProgressInfo(null);
  };

  const handleDifficultyChange = (nextDifficulty: SkyMathDifficulty) => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
    }
    answeringRef.current = false;
    setDifficulty(nextDifficulty);
    setIndex(0);
    setScore(0);
    setSelectedOption(null);
    setQuestion(createQuestion(0, nextDifficulty));
    setShowResult(false);
    setIsPaused(false);
    setProgressInfo(null);
  };

  const handleAnswer = (value: number) => {
    if (answeringRef.current || selectedOption !== null || isPaused) {
      return;
    }
    answeringRef.current = true;
    setSelectedOption(value);

    const isCorrect = value === question.answer;
    const nextScore = score + (isCorrect ? 10 : 0);
    isCorrect ? haptic.success() : haptic.error();

    advanceTimer.current = setTimeout(() => {
      if (index + 1 >= TOTAL_QUESTIONS) {
        setScore(nextScore);
        const info = updateProgress("sky-math", nextScore);
        setProgressInfo(info);
        setShowResult(true);
        return;
      }

      setScore(nextScore);
      setIndex((prev) => prev + 1);
      setSelectedOption(null);
      setQuestion(createQuestion(index + 1, difficulty));
      answeringRef.current = false;
    }, 550);
  };

  return (
    <View style={styles.root}>
      {/* ── Header controls ── */}
      <RNView style={styles.headerRow}>
        <RNView style={[styles.bestPill, { backgroundColor: theme.card }]}>
          <Text style={[styles.bestLabel, { color: theme.mutedText }]}>
            {t("gameBest")}
          </Text>
          <Text style={[styles.bestValue, { color: theme.tint }]}>
            {storedBest}
          </Text>
        </RNView>
        <GameControls
          isPaused={isPaused}
          onPause={() => setIsPaused(true)}
          onReset={restart}
        />
      </RNView>

      <GamePauseOverlay
        onRestart={restart}
        onResume={() => setIsPaused(false)}
        visible={isPaused}
      />

      <RNView style={styles.diffRow}>
        {(["easy", "medium", "hard"] as const).map((key) => {
          const isActive = difficulty === key;
          const labelKey =
            key === "easy"
              ? "difficultyEasy"
              : key === "medium"
                ? "difficultyMedium"
                : "difficultyHard";
          return (
            <Pressable
              accessibilityLabel={t(labelKey)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              key={key}
              onPress={() => handleDifficultyChange(key)}
              style={[
                styles.diffChip,
                {
                  backgroundColor: isActive ? theme.tint : theme.card,
                  borderColor: isActive ? theme.tint : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.diffChipText,
                  { color: isActive ? theme.onTint : theme.text },
                ]}
              >
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </RNView>

      {/* ── Progress ── */}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: theme.card }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.tint, flex: progressFraction },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: theme.mutedText }]}>
          {progressLabel}
        </Text>
      </View>

      {/* ── Question card ── */}
      <View
        style={[
          styles.questionCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.questionText, { color: theme.text }]}>
          {question.text}
        </Text>
        <Text style={[styles.questionEquals, { color: theme.mutedText }]}>
          =
        </Text>
      </View>

      {/* ── Options ── */}
      <View style={styles.options}>
        {question.options.map((option) => {
          const isSelected = selectedOption === option;
          const isCorrect = option === question.answer;
          const showResult = selectedOption !== null;

          const bg =
            showResult && isCorrect
              ? theme.successSurface
              : showResult && isSelected && !isCorrect
                ? theme.dangerSurface
                : theme.elevated;
          const border =
            showResult && isCorrect
              ? theme.successBorder
              : showResult && isSelected && !isCorrect
                ? theme.dangerBorder
                : theme.border;

          return (
            <Pressable
              key={option}
              onPress={() => handleAnswer(option)}
              style={[
                styles.optionBtn,
                { backgroundColor: bg, borderColor: border },
              ]}
            >
              <Text style={[styles.optionText, { color: theme.text }]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Score ── */}
      <Text style={[styles.scoreText, { color: theme.mutedText }]}>
        {t("skyMathScore", { score })}
      </Text>

      {showResult && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("skyMathResult", {
            correct: Math.round(score / 10),
            score,
            total: TOTAL_QUESTIONS,
          })}
          title={t("skyMathFinished")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bestLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bestPill: {
    alignItems: "baseline",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bestValue: { fontSize: 16, fontWeight: "900" },
  diffChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  diffChipText: { fontSize: 12, fontWeight: "700" },
  diffRow: { flexDirection: "row", gap: 8 },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionBtn: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 16,
  },
  /* ── Options ── */
  options: { gap: 10 },
  optionText: { fontSize: 24, fontWeight: "800" },
  progressFill: { borderRadius: 999 },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
  },
  /* ── Progress ── */
  progressRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  progressTrack: {
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  /* ── Question ── */
  questionCard: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  questionEquals: { fontSize: 20, fontWeight: "700" },
  questionText: { fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  root: { flex: 1, gap: 16, padding: 20 },
  /* ── Score ── */
  scoreText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
