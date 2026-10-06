import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import GameControls from "@/components/GameControls";
import GamePauseOverlay from "@/components/GamePauseOverlay";
import GameResult from "@/components/GameResult";

import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/i18n/translations";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

interface QuizQuestion {
  answerIndex: number;
  options: string[];
  question: string;
}

const QUESTION_COUNT = 15;

function getAllQuestions(t: (key: TranslationKey) => string): QuizQuestion[] {
  return [
    {
      answerIndex: 2,
      options: [t("quizQ1a"), t("quizQ1b"), t("quizQ1c"), t("quizQ1d")],
      question: t("quizQ1"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ2a"), t("quizQ2b"), t("quizQ2c"), t("quizQ2d")],
      question: t("quizQ2"),
    },
    {
      answerIndex: 2,
      options: [t("quizQ3a"), t("quizQ3b"), t("quizQ3c"), t("quizQ3d")],
      question: t("quizQ3"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ4a"), t("quizQ4b"), t("quizQ4c"), t("quizQ4d")],
      question: t("quizQ4"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ5a"), t("quizQ5b"), t("quizQ5c"), t("quizQ5d")],
      question: t("quizQ5"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ6a"), t("quizQ6b"), t("quizQ6c"), t("quizQ6d")],
      question: t("quizQ6"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ7a"), t("quizQ7b"), t("quizQ7c"), t("quizQ7d")],
      question: t("quizQ7"),
    },
    {
      answerIndex: 2,
      options: [t("quizQ8a"), t("quizQ8b"), t("quizQ8c"), t("quizQ8d")],
      question: t("quizQ8"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ9a"), t("quizQ9b"), t("quizQ9c"), t("quizQ9d")],
      question: t("quizQ9"),
    },
    {
      answerIndex: 2,
      options: [t("quizQ10a"), t("quizQ10b"), t("quizQ10c"), t("quizQ10d")],
      question: t("quizQ10"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ11a"), t("quizQ11b"), t("quizQ11c"), t("quizQ11d")],
      question: t("quizQ11"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ12a"), t("quizQ12b"), t("quizQ12c"), t("quizQ12d")],
      question: t("quizQ12"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ13a"), t("quizQ13b"), t("quizQ13c"), t("quizQ13d")],
      question: t("quizQ13"),
    },
    {
      answerIndex: 2,
      options: [t("quizQ14a"), t("quizQ14b"), t("quizQ14c"), t("quizQ14d")],
      question: t("quizQ14"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ15a"), t("quizQ15b"), t("quizQ15c"), t("quizQ15d")],
      question: t("quizQ15"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ16a"), t("quizQ16b"), t("quizQ16c"), t("quizQ16d")],
      question: t("quizQ16"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ17a"), t("quizQ17b"), t("quizQ17c"), t("quizQ17d")],
      question: t("quizQ17"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ18a"), t("quizQ18b"), t("quizQ18c"), t("quizQ18d")],
      question: t("quizQ18"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ19a"), t("quizQ19b"), t("quizQ19c"), t("quizQ19d")],
      question: t("quizQ19"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ20a"), t("quizQ20b"), t("quizQ20c"), t("quizQ20d")],
      question: t("quizQ20"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ21a"), t("quizQ21b"), t("quizQ21c"), t("quizQ21d")],
      question: t("quizQ21"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ22a"), t("quizQ22b"), t("quizQ22c"), t("quizQ22d")],
      question: t("quizQ22"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ23a"), t("quizQ23b"), t("quizQ23c"), t("quizQ23d")],
      question: t("quizQ23"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ24a"), t("quizQ24b"), t("quizQ24c"), t("quizQ24d")],
      question: t("quizQ24"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ25a"), t("quizQ25b"), t("quizQ25c"), t("quizQ25d")],
      question: t("quizQ25"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ26a"), t("quizQ26b"), t("quizQ26c"), t("quizQ26d")],
      question: t("quizQ26"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ27a"), t("quizQ27b"), t("quizQ27c"), t("quizQ27d")],
      question: t("quizQ27"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ28a"), t("quizQ28b"), t("quizQ28c"), t("quizQ28d")],
      question: t("quizQ28"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ29a"), t("quizQ29b"), t("quizQ29c"), t("quizQ29d")],
      question: t("quizQ29"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ30a"), t("quizQ30b"), t("quizQ30c"), t("quizQ30d")],
      question: t("quizQ30"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ31a"), t("quizQ31b"), t("quizQ31c"), t("quizQ31d")],
      question: t("quizQ31"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ32a"), t("quizQ32b"), t("quizQ32c"), t("quizQ32d")],
      question: t("quizQ32"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ33a"), t("quizQ33b"), t("quizQ33c"), t("quizQ33d")],
      question: t("quizQ33"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ34a"), t("quizQ34b"), t("quizQ34c"), t("quizQ34d")],
      question: t("quizQ34"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ35a"), t("quizQ35b"), t("quizQ35c"), t("quizQ35d")],
      question: t("quizQ35"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ36a"), t("quizQ36b"), t("quizQ36c"), t("quizQ36d")],
      question: t("quizQ36"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ37a"), t("quizQ37b"), t("quizQ37c"), t("quizQ37d")],
      question: t("quizQ37"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ38a"), t("quizQ38b"), t("quizQ38c"), t("quizQ38d")],
      question: t("quizQ38"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ39a"), t("quizQ39b"), t("quizQ39c"), t("quizQ39d")],
      question: t("quizQ39"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ40a"), t("quizQ40b"), t("quizQ40c"), t("quizQ40d")],
      question: t("quizQ40"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ41a"), t("quizQ41b"), t("quizQ41c"), t("quizQ41d")],
      question: t("quizQ41"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ42a"), t("quizQ42b"), t("quizQ42c"), t("quizQ42d")],
      question: t("quizQ42"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ43a"), t("quizQ43b"), t("quizQ43c"), t("quizQ43d")],
      question: t("quizQ43"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ44a"), t("quizQ44b"), t("quizQ44c"), t("quizQ44d")],
      question: t("quizQ44"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ45a"), t("quizQ45b"), t("quizQ45c"), t("quizQ45d")],
      question: t("quizQ45"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ46a"), t("quizQ46b"), t("quizQ46c"), t("quizQ46d")],
      question: t("quizQ46"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ47a"), t("quizQ47b"), t("quizQ47c"), t("quizQ47d")],
      question: t("quizQ47"),
    },
    {
      answerIndex: 0,
      options: [t("quizQ48a"), t("quizQ48b"), t("quizQ48c"), t("quizQ48d")],
      question: t("quizQ48"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ49a"), t("quizQ49b"), t("quizQ49c"), t("quizQ49d")],
      question: t("quizQ49"),
    },
    {
      answerIndex: 1,
      options: [t("quizQ50a"), t("quizQ50b"), t("quizQ50c"), t("quizQ50d")],
      question: t("quizQ50"),
    },
  ];
}

function pickRandom(all: QuizQuestion[], count: number): QuizQuestion[] {
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export default function QuizGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore((s) => s.progress.quiz?.highScore ?? 0);
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [questions, setQuestions] = useState(() =>
    pickRandom(getAllQuestions(t), QUESTION_COUNT)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  const currentQuestion = questions[currentIndex];
  const progressFraction = (currentIndex + 1) / questions.length;

  // Synchronous re-entry guard so two near-simultaneous taps cannot
  // double-advance or fire updateProgress twice on the last question.
  const answeringRef = useRef<boolean>(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    },
    []
  );

  // Feedback animation: subtle pulse on correct, shake on wrong
  const cardScale = useSharedValue(1);
  const cardShake = useSharedValue(0);
  const cardFeedbackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateX: cardShake.value }],
  }));

  // Shuffle once per question so correct answer isn't always at position [1]
  const shuffledOptions = useMemo(
    () => [...currentQuestion.options].sort(() => Math.random() - 0.5),
    [currentQuestion.options]
  );

  const handleAnswer = (choice: string) => {
    if (answeringRef.current || selectedOption !== null || isPaused) {
      return;
    }
    answeringRef.current = true;

    setSelectedOption(choice);
    const isCorrect =
      choice === currentQuestion.options[currentQuestion.answerIndex];
    const nextScore = score + (isCorrect ? 10 : 0);
    if (isCorrect) {
      haptic.success();
    } else {
      haptic.error();
    }

    if (isCorrect) {
      cardScale.value = withSequence(
        withTiming(1.03, { duration: 100 }),
        withTiming(1, { duration: 130 })
      );
    } else {
      cardShake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }

    advanceTimer.current = setTimeout(() => {
      if (currentIndex >= questions.length - 1) {
        const info = updateProgress("quiz", nextScore);
        setProgressInfo(info);
        setScore(nextScore);
        setShowResult(true);
        return;
      }

      setScore(nextScore);
      setSelectedOption(null);
      setCurrentIndex((prev) => prev + 1);
      answeringRef.current = false;
    }, 750);
  };

  const correctAnswer = currentQuestion.options[currentQuestion.answerIndex];

  const restart = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
    }
    answeringRef.current = false;
    setQuestions(pickRandom(getAllQuestions(t), QUESTION_COUNT));
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setShowResult(false);
    setIsPaused(false);
    setProgressInfo(null);
  };

  return (
    <View style={styles.root}>
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
          {currentIndex + 1}/{questions.length}
        </Text>
      </View>

      <Animated.View
        entering={FadeInDown.duration(200)}
        key={currentIndex}
        style={[
          styles.questionCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          cardFeedbackStyle,
        ]}
      >
        <Text style={[styles.questionText, { color: theme.text }]}>
          {currentQuestion.question}
        </Text>
      </Animated.View>

      <View style={styles.options}>
        {shuffledOptions.map((option) => {
          const isSelected = selectedOption === option;
          const isCorrect = option === correctAnswer;
          const showAnswer = selectedOption !== null;

          let bg = theme.elevated;
          let borderCol = theme.border;
          if (showAnswer && isCorrect) {
            bg = theme.successSurface;
            borderCol = theme.successBorder;
          } else if (showAnswer && isSelected && !isCorrect) {
            bg = theme.dangerSurface;
            borderCol = theme.dangerBorder;
          }

          return (
            <Pressable
              accessibilityLabel={option}
              accessibilityRole="button"
              key={option}
              onPress={() => handleAnswer(option)}
              style={[
                styles.optionBtn,
                { backgroundColor: bg, borderColor: borderCol },
              ]}
            >
              <Text style={[styles.optionText, { color: theme.text }]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedOption === null ? null : (
        <Text style={[styles.answerHint, { color: theme.mutedText }]}>
          {t("quizCorrectAnswer", { answer: correctAnswer })}
        </Text>
      )}

      <Text style={[styles.scoreText, { color: theme.mutedText }]}>
        {t("quizScore", { score })}
      </Text>

      {showResult ? (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("quizResult", {
            correct: Math.round(score / 10),
            score,
            total: questions.length,
          })}
          title={t("quizFinished")}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  answerHint: { fontSize: 13, fontWeight: "600" },
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
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  options: { gap: 10 },
  optionText: { fontSize: 16, fontWeight: "600" },
  progressFill: { borderRadius: 999 },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "right",
  },
  progressRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  progressTrack: {
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  questionCard: { borderRadius: 18, borderWidth: 1, padding: 20 },
  questionText: { fontSize: 18, fontWeight: "700", lineHeight: 27 },
  root: { flex: 1, gap: 14, padding: 20 },
  scoreText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
