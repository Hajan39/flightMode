import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
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

const ROUND_SECONDS = 40;

interface Command {
  icon: string;
  id: string;
  labelKey: TranslationKey;
  unlockAt: number;
}

const COMMANDS: Command[] = [
  {
    icon: "shield-checkmark-outline",
    id: "seatbelt",
    labelKey: "ccCmdSeatbelt",
    unlockAt: 0,
  },
  {
    icon: "restaurant-outline",
    id: "tray",
    labelKey: "ccCmdTray",
    unlockAt: 0,
  },
  { icon: "sunny-outline", id: "window", labelKey: "ccCmdWindow", unlockAt: 0 },
  {
    icon: "phone-portrait-outline",
    id: "phone",
    labelKey: "ccCmdPhone",
    unlockAt: 0,
  },
  {
    icon: "flashlight-outline",
    id: "light",
    labelKey: "ccCmdLight",
    unlockAt: 40,
  },
  {
    icon: "musical-notes-outline",
    id: "music",
    labelKey: "ccCmdMusic",
    unlockAt: 80,
  },
  { icon: "bag-outline", id: "bag", labelKey: "ccCmdBag", unlockAt: 130 },
  { icon: "wifi-outline", id: "wifi", labelKey: "ccCmdWifi", unlockAt: 200 },
];

function getActiveCommands(currentScore: number): Command[] {
  return COMMANDS.filter((cmd) => currentScore >= cmd.unlockAt);
}

function randomCommand(currentScore: number, excludeId?: string) {
  const pool = getActiveCommands(currentScore).filter(
    (item) => !excludeId || item.id !== excludeId
  );
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDecoyCount(currentScore: number): number {
  if (currentScore >= 150) {
    return 4;
  }
  if (currentScore >= 80) {
    return 3;
  }
  return 2;
}

type Phase = "running" | "paused" | "over";

export default function CabinCallGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBest = useGameStore(
    (s) => s.progress["cabin-call"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();

  const [phase, setPhase] = useState<Phase>("running");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [target, setTarget] = useState<Command>(() => randomCommand(0));
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );
  const scoreRef = useRef(0);
  const endTimeRef = useRef<number | null>(Date.now() + ROUND_SECONDS * 1000);

  // Feedback animation: subtle pulse on correct, shake on wrong
  const cardScale = useSharedValue(1);
  const cardShake = useSharedValue(0);
  const cardFeedbackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateX: cardShake.value }],
  }));

  useEffect(() => {
    if (phase !== "running") {
      return;
    }

    const tick = () => {
      const endTime = endTimeRef.current;
      if (!endTime) {
        return;
      }

      const remainingMs = endTime - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));

      if (remainingMs <= 0) {
        endTimeRef.current = null;
        const info = updateProgress("cabin-call", scoreRef.current);
        setProgressInfo(info);
        setPhase("over");
        haptic.heavy();
      }
    };

    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [phase, updateProgress, haptic]);

  const [choices, setChoices] = useState<Command[]>(() => {
    const active = getActiveCommands(0);
    const numDecoys = getDecoyCount(0);
    const decoys = active
      .filter((item) => item.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, numDecoys);
    return [target, ...decoys].sort(() => Math.random() - 0.5);
  });

  useEffect(() => {
    const active = getActiveCommands(score);
    const numDecoys = getDecoyCount(score);
    const decoys = active
      .filter((item) => item.id !== target.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, numDecoys);
    setChoices([target, ...decoys].sort(() => Math.random() - 0.5));
  }, [score, target]);

  const restart = () => {
    endTimeRef.current = Date.now() + ROUND_SECONDS * 1000;
    setSecondsLeft(ROUND_SECONDS);
    setScore(0);
    scoreRef.current = 0;
    setStreak(0);
    setTarget(randomCommand(0));
    setProgressInfo(null);
    setPhase("running");
  };

  const pause = () => {
    endTimeRef.current = null;
    setPhase("paused");
  };

  const resume = () => {
    endTimeRef.current = Date.now() + secondsLeft * 1000;
    setPhase("running");
  };

  const handleChoice = (choice: Command) => {
    if (phase !== "running") {
      return;
    }

    if (choice.id === target.id) {
      haptic.success();
      cardScale.value = withSequence(
        withTiming(1.04, { duration: 100 }),
        withTiming(1, { duration: 130 })
      );
      setScore((prev) => {
        const next = prev + 10 + Math.min(10, streak * 2);
        scoreRef.current = next;
        return next;
      });
      setStreak((prev) => prev + 1);
    } else {
      haptic.error();
      cardShake.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      setScore((prev) => {
        const next = Math.max(0, prev - 6);
        scoreRef.current = next;
        return next;
      });
      setStreak(0);
    }

    setTarget((prev) => randomCommand(scoreRef.current, prev.id));
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
          isPaused={phase === "paused"}
          onPause={phase === "running" ? pause : undefined}
          onReset={restart}
        />
      </RNView>

      <RNView style={styles.statsRow}>
        <RNView style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("ccTime")}
          </Text>
          <Text
            style={[
              styles.statValue,
              { color: secondsLeft <= 5 ? theme.danger : theme.text },
            ]}
          >
            {secondsLeft}
          </Text>
        </RNView>
        <RNView
          style={[styles.statDivider, { backgroundColor: theme.border }]}
        />
        <RNView style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: theme.mutedText }]}>
            {t("ccScore")}
          </Text>
          <Text style={[styles.statValue, { color: theme.tint }]}>{score}</Text>
        </RNView>
      </RNView>

      <Animated.View
        style={[
          styles.targetCard,
          { backgroundColor: theme.card, borderColor: theme.border },
          cardFeedbackStyle,
        ]}
      >
        <Text style={[styles.targetHint, { color: theme.mutedText }]}>
          {t("ccCrewSays")}
        </Text>
        <Animated.View
          entering={FadeInDown.duration(180)}
          key={target.id}
          style={styles.targetContent}
        >
          <Ionicons color={theme.tint} name={target.icon as never} size={40} />
          <Text style={styles.targetText}>{t(target.labelKey)}</Text>
        </Animated.View>
      </Animated.View>

      <RNView style={styles.choiceList}>
        {choices.map((choice) => (
          <Pressable
            accessibilityLabel={t(choice.labelKey)}
            accessibilityRole="button"
            key={choice.id}
            onPress={() => handleChoice(choice)}
            style={[
              styles.choice,
              { backgroundColor: theme.elevated, borderColor: theme.border },
            ]}
          >
            <Ionicons
              color={theme.tint}
              name={choice.icon as never}
              size={20}
            />
            <Text style={styles.choiceText}>{t(choice.labelKey)}</Text>
          </Pressable>
        ))}
      </RNView>

      <Text style={[styles.streakText, { color: theme.mutedText }]}>
        {t("ccStreak", { streak })}
      </Text>

      <GamePauseOverlay
        onRestart={restart}
        onResume={resume}
        visible={phase === "paused"}
      />

      {phase === "over" && (
        <GameResult
          best={progressInfo?.best ?? storedBest}
          isNewBest={progressInfo?.isNewBest}
          last={progressInfo?.previousBest}
          onPlayAgain={restart}
          score={score}
          streak={progressInfo?.currentStreak}
          subtitle={t("ccTimeUpSubtitle", { score, streak })}
          title={t("ccTimeUp")}
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
  choice: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  choiceList: { gap: 10 },
  choiceText: { fontSize: 15, fontWeight: "700" },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  root: { flex: 1, gap: 16, justifyContent: "center", padding: 20 },
  statBlock: { alignItems: "center", flex: 1, gap: 2, paddingVertical: 4 },
  statDivider: { height: 56, width: 1 },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  statValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  streakText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  targetCard: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    paddingVertical: 20,
  },
  targetContent: { alignItems: "center", gap: 8 },
  targetHint: { fontSize: 13, fontWeight: "600" },
  targetText: {
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: 12,
    textAlign: "center",
  },
});
