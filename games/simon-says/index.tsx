import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View as RNView, StyleSheet } from "react-native";
import GameControls from "@/components/GameControls";
import GameResult from "@/components/GameResult";
import { Text, View } from "@/components/Themed";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useGameDimensions } from "@/hooks/useGameDimensions";
import { useHaptic } from "@/hooks/useHaptic";
import { useTranslation } from "@/hooks/useTranslation";
import { useGameStore } from "@/store/useGameStore";
import type { GameProgressUpdate } from "@/types/game";

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_LIVES = 3;
const BASE_FLASH_MS = 500;
const FLASH_GAP_MS = 200;
const MIN_FLASH_MS = 250;
const FLASH_SPEED_DEDUCT = 10; // ms deducted per sequence step
const NEXT_ROUND_DELAY_MS = 600;

// ── Button definitions ────────────────────────────────────────────────────────
type ButtonId = 0 | 1 | 2 | 3;

const BUTTON_COLORS: Record<ButtonId, { dim: string; lit: string }> = {
  0: { dim: "#8B1A1A", lit: "#E53935" }, // red
  1: { dim: "#0D3B6E", lit: "#1E88E5" }, // blue
  2: { dim: "#1B4D1E", lit: "#43A047" }, // green
  3: { dim: "#6B5900", lit: "#E6C200" }, // yellow
};

const BUTTON_LABEL_KEYS: Record<
  ButtonId,
  "colorRed" | "colorBlue" | "colorGreen" | "colorYellow"
> = {
  0: "colorRed",
  1: "colorBlue",
  2: "colorGreen",
  3: "colorYellow",
};

type Phase = "idle" | "showing" | "input" | "done";

// ── Component ─────────────────────────────────────────────────────────────────
export default function SimonSaysGame() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const updateProgress = useGameStore((s) => s.updateProgress);
  const storedBestScore = useGameStore(
    (s) => s.progress["simon-says"]?.highScore ?? 0
  );
  const { t } = useTranslation();
  const haptic = useHaptic();
  const { height, width } = useGameDimensions();
  // Explicit size: a % width + aspectRatio inside a wrapping row collapses to 0 height.
  const padSize = Math.floor(
    Math.min((width - 40 - 12) / 2, (height - 360) / 2)
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("idle");
  const [litButton, setLitButton] = useState<ButtonId | null>(null);
  const [lives, setLives] = useState(MAX_LIVES);
  const [round, setRound] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [progressInfo, setProgressInfo] = useState<GameProgressUpdate | null>(
    null
  );

  // ── Refs to avoid stale closures ───────────────────────────────────────────
  const sequenceRef = useRef<ButtonId[]>([]);
  const positionRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const phaseRef = useRef<Phase>("idle");

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const clearAllTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) {
      clearTimeout(id);
    }
    timeoutsRef.current = [];
  }, []);

  const addTimeout = useCallback(
    (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
      const id = setTimeout(fn, ms);
      timeoutsRef.current.push(id);
      return id;
    },
    []
  );

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => clearAllTimeouts(), [clearAllTimeouts]);

  // ── End game ──────────────────────────────────────────────────────────────
  const endGame = useCallback(
    (score: number) => {
      clearAllTimeouts();
      phaseRef.current = "done";
      setPhase("done");
      setLitButton(null);

      const info = updateProgress("simon-says", score);
      setProgressInfo(info);
      setFinalScore(score);
    },
    [clearAllTimeouts, updateProgress]
  );

  // ── Play the sequence ─────────────────────────────────────────────────────
  const playSequence = useCallback(
    (seq: ButtonId[]) => {
      clearAllTimeouts();
      phaseRef.current = "showing";
      setPhase("showing");
      setLitButton(null);

      const seqLen = seq.length;
      // Flash duration gets faster as sequence grows
      const flashMs = Math.max(
        MIN_FLASH_MS,
        BASE_FLASH_MS - FLASH_SPEED_DEDUCT * (seqLen - 1)
      );
      const stepMs = flashMs + FLASH_GAP_MS;

      seq.forEach((btnId, i) => {
        // Light up
        addTimeout(() => {
          setLitButton(btnId);
        }, i * stepMs);

        // Dim
        addTimeout(
          () => {
            setLitButton(null);
          },
          i * stepMs + flashMs
        );
      });

      // After all flashes done, switch to input phase
      addTimeout(() => {
        positionRef.current = 0;
        phaseRef.current = "input";
        setPhase("input");
      }, seqLen * stepMs);
    },
    [clearAllTimeouts, addTimeout]
  );

  // ── Start a new round ─────────────────────────────────────────────────────
  const startRound = useCallback(
    (currentSeq: ButtonId[]) => {
      // Add one random step
      const next = Math.floor(Math.random() * 4) as ButtonId;
      const newSeq = [...currentSeq, next];
      sequenceRef.current = newSeq;

      setRound(newSeq.length);
      playSequence(newSeq);
    },
    [playSequence]
  );

  // ── Handle player button press ────────────────────────────────────────────
  const handleButtonPress = useCallback(
    (btnId: ButtonId) => {
      if (phaseRef.current !== "input") {
        return;
      }

      const expected = sequenceRef.current[positionRef.current];

      // Brief highlight feedback
      setLitButton(btnId);
      addTimeout(() => setLitButton(null), 150);

      if (btnId === expected) {
        haptic.tap();
        positionRef.current += 1;

        if (positionRef.current === sequenceRef.current.length) {
          // Completed the sequence!
          haptic.success();
          phaseRef.current = "showing"; // block further input while waiting
          setPhase("showing");

          addTimeout(() => {
            startRound(sequenceRef.current);
          }, NEXT_ROUND_DELAY_MS);
        }
      } else {
        // Wrong button
        haptic.error();
        const newLives = livesRef.current - 1;
        livesRef.current = newLives;
        setLives(newLives);

        if (newLives <= 0) {
          // Score = sequences completed (current sequence length - 1, since this one failed)
          const completedSequences = sequenceRef.current.length - 1;
          addTimeout(() => endGame(completedSequences), 300);
        } else {
          // Replay current sequence after a short pause
          phaseRef.current = "showing";
          setPhase("showing");
          addTimeout(() => {
            playSequence(sequenceRef.current);
          }, 800);
        }
      }
    },
    [haptic, addTimeout, startRound, playSequence, endGame]
  );

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    clearAllTimeouts();
    sequenceRef.current = [];
    positionRef.current = 0;
    livesRef.current = MAX_LIVES;

    setLives(MAX_LIVES);
    setRound(0);
    setLitButton(null);
    setFinalScore(null);
    setProgressInfo(null);
    phaseRef.current = "showing";
    setPhase("showing");

    startRound([]);
  }, [clearAllTimeouts, startRound]);

  // ── Reset / restart ───────────────────────────────────────────────────────
  const restart = useCallback(() => {
    clearAllTimeouts();
    sequenceRef.current = [];
    positionRef.current = 0;
    livesRef.current = MAX_LIVES;

    phaseRef.current = "idle";
    setPhase("idle");
    setLives(MAX_LIVES);
    setRound(0);
    setLitButton(null);
    setFinalScore(null);
    setProgressInfo(null);
  }, [clearAllTimeouts]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isIdle = phase === "idle";
  const isShowing = phase === "showing";
  const isInput = phase === "input";
  const isDone = phase === "done";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <GameControls onReset={restart} />

      {/* Lives + round header (visible during active play) */}
      {!(isIdle || isDone) && (
        <RNView style={styles.header}>
          {/* Lives dots */}
          <RNView style={styles.livesRow}>
            <Text style={[styles.headerLabel, { color: theme.mutedText }]}>
              {t("colorClashLives")}
            </Text>
            <RNView style={styles.dotsRow}>
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <RNView
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i < lives ? theme.danger : theme.border,
                    },
                  ]}
                />
              ))}
            </RNView>
          </RNView>

          {/* Round counter */}
          <RNView style={styles.roundBlock}>
            <Text style={[styles.headerLabel, { color: theme.mutedText }]}>
              {t("simonRound")}
            </Text>
            <Text style={[styles.roundValue, { color: theme.text }]}>
              {round}
            </Text>
          </RNView>
        </RNView>
      )}

      {/* Phase indicator */}
      {!(isIdle || isDone) && (
        <RNView style={styles.phaseRow}>
          <Text
            style={[
              styles.phaseText,
              {
                color: isShowing ? theme.mutedText : theme.tint,
                opacity: isShowing ? 0.6 : 1,
              },
            ]}
          >
            {isShowing ? t("simonWatchNow") : t("simonYourTurn")}
          </Text>
        </RNView>
      )}

      {/* 2×2 Simon button grid */}
      <RNView pointerEvents={isInput ? "auto" : "none"} style={styles.grid}>
        {([0, 1, 2, 3] as ButtonId[]).map((btnId) => {
          const isLit = litButton === btnId;
          const colors = BUTTON_COLORS[btnId];
          return (
            <Pressable
              accessibilityLabel={t(BUTTON_LABEL_KEYS[btnId])}
              accessibilityRole="button"
              key={btnId}
              onPress={() => handleButtonPress(btnId)}
              style={[
                styles.simonBtn,
                {
                  backgroundColor: isLit ? colors.lit : colors.dim,
                  height: padSize,
                  opacity: isInput ? 1 : 0.85,
                  width: padSize,
                },
              ]}
            />
          );
        })}
      </RNView>

      {/* Idle start hint */}
      {isIdle && finalScore === null && (
        <Pressable
          accessibilityLabel={t("gameTapToStart")}
          accessibilityRole="button"
          onPress={startGame}
          style={styles.startArea}
        >
          <Text style={[styles.startText, { color: theme.mutedText }]}>
            {t("gameTapToStart")}
          </Text>
        </Pressable>
      )}

      {/* Result overlay */}
      {finalScore !== null && (
        <GameResult
          best={progressInfo?.best ?? storedBestScore}
          isNewBest={progressInfo?.isNewBest}
          last={
            progressInfo?.last === undefined ? undefined : progressInfo.last
          }
          onPlayAgain={startGame}
          score={finalScore}
          streak={progressInfo?.currentStreak}
          title={t("gameSimonSaysName")}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  grid: {
    alignContent: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
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
  livesRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  phaseRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  phaseText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  root: { flex: 1, gap: 12, padding: 20 },
  roundBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  roundValue: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 30,
  },
  simonBtn: {
    borderRadius: 20,
  },
  startArea: {
    alignItems: "center",
    bottom: 0,
    left: 0,
    paddingBottom: 32,
    position: "absolute",
    right: 0,
  },
  startText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
